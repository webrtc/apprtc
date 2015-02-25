/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals TestCase, assertEquals, Constants, FAKE_WSS_URL, apprtc,
   RemoteWebSocket, MockWindowPort */

'use strict';
var TEST_MESSAGE = 'foobar';

var RemoteWebSocketTest = new TestCase('RemoteWebSocketTest');

RemoteWebSocketTest.prototype.setUp = function() {
  this.realWindowPort = apprtc.windowPort;
  apprtc.windowPort = new MockWindowPort();

  this.rws_ = new RemoteWebSocket(FAKE_WSS_URL);
  // Should have an message to request create.
  assertEquals(1, apprtc.windowPort.messages.length);
  assertEquals(Constants.WS_ACTION, apprtc.windowPort.messages[0].action);
  assertEquals(Constants.WS_CREATE_ACTION,
      apprtc.windowPort.messages[0].wsAction);
  assertEquals(FAKE_WSS_URL, apprtc.windowPort.messages[0].wssUrl);
  assertEquals(WebSocket.CONNECTING, this.rws_.readyState);

};

RemoteWebSocketTest.prototype.tearDown = function() {
  apprtc.windowPort = this.realWindowPort;
};

RemoteWebSocketTest.prototype.testSendBeforeOpen = function() {
  var exception = false;
  try {
    this.rws_.send(TEST_MESSAGE);
  } catch (ex) {
    if (ex) {
      exception = true;
    }
  }

  assertEquals(true, exception);
};

RemoteWebSocketTest.prototype.testSend = function() {
  apprtc.windowPort.simulateMessageFromBackground({
    action: Constants.WS_ACTION,
    wsAction: Constants.EVENT_ACTION,
    wsEvent: Constants.WS_EVENT_ONOPEN,
    data: TEST_MESSAGE
  });

  assertEquals(1, apprtc.windowPort.messages.length);
  this.rws_.send(TEST_MESSAGE);
  assertEquals(2, apprtc.windowPort.messages.length);
  assertEquals(Constants.WS_ACTION, apprtc.windowPort.messages[1].action);
  assertEquals(Constants.WS_SEND_ACTION,
      apprtc.windowPort.messages[1].wsAction);
  assertEquals(TEST_MESSAGE, apprtc.windowPort.messages[1].data);
};

RemoteWebSocketTest.prototype.testClose = function() {
  var message = null;
  var called = false;
  this.rws_.onclose = function(e) {
    called = true;
    message = e;
  };

  assertEquals(1, apprtc.windowPort.messages.length);
  this.rws_.close();

  assertEquals(2, apprtc.windowPort.messages.length);
  assertEquals(Constants.WS_ACTION, apprtc.windowPort.messages[1].action);
  assertEquals(Constants.WS_CLOSE_ACTION,
      apprtc.windowPort.messages[1].wsAction);

  assertEquals(WebSocket.CLOSING, this.rws_.readyState);
  apprtc.windowPort.simulateMessageFromBackground({
    action: Constants.WS_ACTION,
    wsAction: Constants.EVENT_ACTION,
    wsEvent: Constants.WS_EVENT_ONCLOSE,
    data: TEST_MESSAGE
  });
  assertEquals(true, called);
  assertEquals(TEST_MESSAGE, message);
  assertEquals(WebSocket.CLOSED, this.rws_.readyState);
};

RemoteWebSocketTest.prototype.testOnError = function() {
  var message = null;
  var called = false;
  this.rws_.onerror = function(e) {
    called = true;
    message = e;
  };

  apprtc.windowPort.simulateMessageFromBackground({
    action: Constants.WS_ACTION,
    wsAction: Constants.EVENT_ACTION,
    wsEvent: Constants.WS_EVENT_ONERROR,
    data: TEST_MESSAGE
  });
  assertEquals(true, called);
  assertEquals(TEST_MESSAGE, message);
};

RemoteWebSocketTest.prototype.testOnOpen = function() {
  var called = false;
  this.rws_.onopen = function() {
    called = true;
  };

  apprtc.windowPort.simulateMessageFromBackground({
    action: Constants.WS_ACTION,
    wsAction: Constants.EVENT_ACTION,
    wsEvent: Constants.WS_EVENT_ONOPEN,
    data: TEST_MESSAGE
  });
  assertEquals(true, called);
  assertEquals(WebSocket.OPEN, this.rws_.readyState);
};

RemoteWebSocketTest.prototype.testOnMessage = function() {
  var message = null;
  var called = false;
  this.rws_.onmessage = function(e) {
    called = true;
    message = e;
  };

  apprtc.windowPort.simulateMessageFromBackground({
    action: Constants.WS_ACTION,
    wsAction: Constants.EVENT_ACTION,
    wsEvent: Constants.WS_EVENT_ONMESSAGE,
    data: TEST_MESSAGE
  });
  assertEquals(true, called);
  assertEquals(TEST_MESSAGE, message);
};

RemoteWebSocketTest.prototype.testOnSendError = function() {
  var message = null;
  var called = false;
  this.rws_.onsenderror = function(e) {
    called = true;
    message = e;
  };

  apprtc.windowPort.simulateMessageFromBackground({
    action: Constants.WS_ACTION,
    wsAction: Constants.EVENT_ACTION,
    wsEvent: Constants.WS_EVENT_SENDERROR,
    data: TEST_MESSAGE
  });
  assertEquals(true, called);
  assertEquals(TEST_MESSAGE, message);
};
