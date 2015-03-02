/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals TestCase, assertEquals, xhrs:true, MockWebSocket, FAKE_WSS_POST_URL,
   Constants, webSockets:true, FAKE_WSS_URL, WebSocket:true, MockXMLHttpRequest,
   XMLHttpRequest:true, FAKE_SEND_EXCEPTION */

'use strict';
var FAKE_MESSAGE = JSON.stringify({
        cmd: 'send',
        msg: JSON.stringify({type: 'bye'})
      });

var MockEvent = function(addListener) {
  this.addListener_ = addListener;
};

MockEvent.prototype.addListener = function(callback) {
  this.addListener_(callback);
};

var MockPort = function() {
  this.onDisconnectCallback_ = null;
  this.onMessageCallback_ = null;
  this.onPostMessage = null;

  this.onDisconnect = new MockEvent(function(callback) {
    this.onDisconnectCallback_ = callback;
  }.bind(this));

  this.onMessage = new MockEvent(function(callback) {
    this.onMessageCallback_ = callback;
  }.bind(this));
};

MockPort.prototype.disconnect = function() {
  if (this.onDisconnectCallback_) {
    this.onDisconnectCallback_();
  }
};

MockPort.prototype.message = function(message) {
  if (this.onMessageCallback_) {
    this.onMessageCallback_(message);
  }
};

MockPort.prototype.postMessage = function(message) {
  if (this.onPostMessage) {
    this.onPostMessage(message);
  }
};

MockPort.prototype.createWebSocket = function() {
  assertEquals(0, webSockets.length);

  this.message({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_CREATE_ACTION,
    wssUrl: FAKE_WSS_URL,
    wssPostUrl: FAKE_WSS_POST_URL
  });

  assertEquals(1, webSockets.length);

  assertEquals(WebSocket.CONNECTING, this.webSocket_.readyState);
};

var BackgroundTest = new TestCase('BackgroundTest');

BackgroundTest.prototype.setUp = function() {
  webSockets = [];
  xhrs = [];

  this.realWebSocket = WebSocket;
  WebSocket = MockWebSocket;

  this.mockPort_ = new MockPort();
  window.chrome.callOnConnect(this.mockPort_);
};

BackgroundTest.prototype.tearDown = function() {
  WebSocket = this.realWebSocket;
};

BackgroundTest.prototype.testCreateWebSocket = function() {
  this.mockPort_.createWebSocket();
};

BackgroundTest.prototype.testCloseWebSocket = function() {
  this.mockPort_.createWebSocket();

  this.mockPort_.message({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_CLOSE_ACTION
  });

  assertEquals(WebSocket.CLOSED, this.mockPort_.webSocket_.readyState);
};

BackgroundTest.prototype.testSendWebSocket = function() {
  this.mockPort_.createWebSocket();

  this.mockPort_.webSocket_.simulateOpenResult(true);

  assertEquals(0, this.mockPort_.webSocket_.messages.length);
  this.mockPort_.message({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_SEND_ACTION,
    data: FAKE_MESSAGE
  });
  assertEquals(1, this.mockPort_.webSocket_.messages.length);
  assertEquals(FAKE_MESSAGE, this.mockPort_.webSocket_.messages[0]);
};

BackgroundTest.prototype.testSendWebSocketNotReady = function() {
  this.mockPort_.createWebSocket();

  // Send without socket being in open state.
  assertEquals(0, this.mockPort_.webSocket_.messages.length);
  var realXMLHttpRequest = XMLHttpRequest;
  XMLHttpRequest = MockXMLHttpRequest;
  this.mockPort_.message({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_SEND_ACTION,
    data: FAKE_MESSAGE
  });
  XMLHttpRequest = realXMLHttpRequest;
  // No messages posted to web socket.
  assertEquals(0, this.mockPort_.webSocket_.messages.length);

  // Message sent via xhr instead.
  assertEquals(1, xhrs.length);
  assertEquals(2, xhrs[0].readyState);
  assertEquals(FAKE_WSS_POST_URL, xhrs[0].url);
  assertEquals('POST', xhrs[0].method);
  assertEquals(JSON.stringify({type: 'bye'}), xhrs[0].body);
};

BackgroundTest.prototype.testSendWebSocketThrows = function() {
  this.mockPort_.createWebSocket();

  this.mockPort_.webSocket_.simulateOpenResult(true);

  // Set mock web socket to throw exception on send().
  this.mockPort_.webSocket_.throwOnSend = true;

  var message = null;
  this.mockPort_.onPostMessage = function(msg) {
    message = msg;
  };

  assertEquals(0, this.mockPort_.webSocket_.messages.length);
  this.mockPort_.message({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_SEND_ACTION,
    data: FAKE_MESSAGE
  });
  assertEquals(0, this.mockPort_.webSocket_.messages.length);

  this.checkMessage_(message,
                     Constants.WS_EVENT_SENDERROR, FAKE_SEND_EXCEPTION);
};

BackgroundTest.prototype.checkMessage_ = function(m, wsEvent, data) {
  assertEquals(Constants.WS_ACTION, m.action);
  assertEquals(Constants.EVENT_ACTION, m.wsAction);
  assertEquals(wsEvent, m.wsEvent);
  if (data) {
    assertEquals(data, m.data);
  }
};

BackgroundTest.prototype.testWebSocketEvents = function() {
  this.mockPort_.createWebSocket();
  var message = null;
  this.mockPort_.onPostMessage = function(msg) {
    message = msg;
  };

  var ws = this.mockPort_.webSocket_;

  ws.onopen();
  this.checkMessage_(message, Constants.WS_EVENT_ONOPEN);

  ws.onerror();
  this.checkMessage_(message, Constants.WS_EVENT_ONERROR);

  ws.onclose(FAKE_MESSAGE);
  this.checkMessage_(message, Constants.WS_EVENT_ONCLOSE, FAKE_MESSAGE);

  ws.onmessage(FAKE_MESSAGE);
  this.checkMessage_(message, Constants.WS_EVENT_ONMESSAGE, FAKE_MESSAGE);
};

BackgroundTest.prototype.testDisconnectClosesWebSocket = function() {
  // Disconnect should cause web socket to be closed.
  var socketClosed = false;

  this.mockPort_.webSocket_ = {
    close: function() {
      socketClosed = true;
    }
  };
  this.mockPort_.disconnect();

  assertEquals(true, socketClosed);
};

BackgroundTest.prototype.testQueueMessages = function() {
  assertEquals(null, this.mockPort_.queue_);

  this.mockPort_.message({
    action: Constants.QUEUEADD_ACTION,
    queueMessage: {
      action: Constants.XHR_ACTION,
      method: 'POST',
      url: '/go/home',
      body: null
    }
  });

  assertEquals(1, this.mockPort_.queue_.length);

  this.mockPort_.message({
    action: Constants.QUEUEADD_ACTION,
    queueMessage: {
      action: Constants.WS_ACTION,
      wsAction: Constants.WS_SEND_ACTION,
      data: JSON.stringify({
        cmd: 'send',
        msg: JSON.stringify({type: 'bye'})
      })
    }
  });

  assertEquals(2, this.mockPort_.queue_.length);

  this.mockPort_.message({action: Constants.QUEUECLEAR_ACTION});
  assertEquals([], this.mockPort_.queue_);
};
