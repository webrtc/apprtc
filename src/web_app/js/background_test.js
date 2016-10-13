/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals describe, expect, it, beforeEach, afterEach, xhrs:true,
   MockWebSocket, FAKE_WSS_POST_URL, Constants, webSockets:true, FAKE_WSS_URL,
   WebSocket:true, MockXMLHttpRequest, XMLHttpRequest:true,
   FAKE_SEND_EXCEPTION */

'use strict';

describe('Background test', function() {
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
    this.queue_ = null;
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
    this.message({
      action: Constants.WS_ACTION,
      wsAction: Constants.WS_CREATE_ACTION,
      wssUrl: FAKE_WSS_URL,
      wssPostUrl: FAKE_WSS_POST_URL
    });
  };

  var checkMessage = function(m, wsEvent, data) {
    expect(m.action).toEqual(Constants.WS_ACTION);
    expect(m.wsAction).toEqual(Constants.EVENT_ACTION);
    expect(m.wsEvent).toEqual(wsEvent);
    if (data) {
      expect(m.data).toEqual(data);
    }
  };

  beforeEach(function() {
    webSockets = [];
    xhrs = [];

    this.realWebSocket = WebSocket;
    WebSocket = MockWebSocket;

    this.mockPort_ = new MockPort();
    window.chrome.callOnConnect(this.mockPort_);
  });

  afterEach(function() {
    WebSocket = this.realWebSocket;
  });

  it('Create WebSocket', function() {
    expect(webSockets.length).toEqual(0);
    this.mockPort_.createWebSocket();
    expect(webSockets.length).toEqual(1);
    expect(this.mockPort_.webSocket_.readyState).toEqual(WebSocket.CONNECTING);
  });

  it('Close WebSocket', function() {
    this.mockPort_.createWebSocket();
    this.mockPort_.message({
      action: Constants.WS_ACTION,
      wsAction: Constants.WS_CLOSE_ACTION
    });
    expect(this.mockPort_.webSocket_.readyState).toEqual(WebSocket.CLOSED);
  });

  it('Send WebSocket', function() {
    this.mockPort_.createWebSocket();
    this.mockPort_.webSocket_.simulateOpenResult(true);
    expect(this.mockPort_.webSocket_.messages.length).toEqual(0);

    this.mockPort_.message({
      action: Constants.WS_ACTION,
      wsAction: Constants.WS_SEND_ACTION,
      data: FAKE_MESSAGE
    });
    expect(this.mockPort_.webSocket_.messages.length).toEqual(1);
    expect(this.mockPort_.webSocket_.messages[0]).toEqual(FAKE_MESSAGE);
  });

  it('Send WebSocket when not ready', function() {
    // Send without socket being in open state.
    this.mockPort_.createWebSocket();
    expect(this.mockPort_.webSocket_.messages.length).toEqual(0);
    var realXMLHttpRequest = XMLHttpRequest;
    XMLHttpRequest = MockXMLHttpRequest;
    this.mockPort_.message({
      action: Constants.WS_ACTION,
      wsAction: Constants.WS_SEND_ACTION,
      data: FAKE_MESSAGE
    });
    XMLHttpRequest = realXMLHttpRequest;
    // No messages posted to web socket.
    expect(this.mockPort_.webSocket_.messages.length).toEqual(0);

    // Message sent via xhr instead.
    expect(xhrs.length).toEqual(1);
    expect(xhrs[0].readyState).toEqual(2);
    expect(xhrs[0].url).toEqual(FAKE_WSS_POST_URL);
    expect(xhrs[0].method).toEqual('POST');
    expect(xhrs[0].body).toEqual(JSON.stringify({type: 'bye'}));
  });

  it('Send WebSocket throws error', function() {
    this.mockPort_.createWebSocket();
    this.mockPort_.webSocket_.simulateOpenResult(true);

    // Set mock web socket to throw exception on send().
    this.mockPort_.webSocket_.throwOnSend = true;

    var message = null;
    this.mockPort_.onPostMessage = function(msg) {
      message = msg;
    };

    expect(this.mockPort_.webSocket_.messages.length).toEqual(0);
    this.mockPort_.message({
      action: Constants.WS_ACTION,
      wsAction: Constants.WS_SEND_ACTION,
      data: FAKE_MESSAGE
    });
    expect(this.mockPort_.webSocket_.messages.length).toEqual(0);

    checkMessage(message, Constants.WS_EVENT_SENDERROR, FAKE_SEND_EXCEPTION);
  });

  it('WebSocket events', function() {
    this.mockPort_.createWebSocket();
    var message = null;
    this.mockPort_.onPostMessage = function(msg) {
      message = msg;
    };

    var ws = this.mockPort_.webSocket_;

    ws.onopen();
    checkMessage(message, Constants.WS_EVENT_ONOPEN);

    ws.onerror();
    checkMessage(message, Constants.WS_EVENT_ONERROR);

    ws.onclose(FAKE_MESSAGE);
    checkMessage(message, Constants.WS_EVENT_ONCLOSE, FAKE_MESSAGE);

    ws.onmessage(FAKE_MESSAGE);
    checkMessage(message, Constants.WS_EVENT_ONMESSAGE, FAKE_MESSAGE);
  });

  it('Disconnect closes the WebSocket', function(done) {
    // Disconnect should cause web socket to be closed.
    this.mockPort_.webSocket_ = {
      close: function() {
        done();
      }
    };
    this.mockPort_.disconnect();
  });

  it('Queue messages', function() {
    expect(this.mockPort_.queue_).toBeNull();

    this.mockPort_.message({
      action: Constants.QUEUEADD_ACTION,
      queueMessage: {
        action: Constants.XHR_ACTION,
        method: 'POST',
        url: '/go/home',
        body: null
      }
    });

    expect(this.mockPort_.queue_.length).toEqual(1);

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

    expect(this.mockPort_.queue_.length).toEqual(2);

    this.mockPort_.message({action: Constants.QUEUECLEAR_ACTION});
    expect(this.mockPort_.queue_).toEqual([]);
  });
});
