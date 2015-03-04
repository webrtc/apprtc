/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals assertEquals */
/* exported FAKE_WSS_POST_URL, FAKE_WSS_URL, FAKE_WSS_POST_URL, FAKE_ROOM_ID,
   FAKE_CLIENT_ID, MockWebSocket, MockXMLHttpRequest, webSockets, xhrs,
   MockWindowPort, FAKE_SEND_EXCEPTION */

'use strict';

var FAKE_WSS_URL = 'wss://foo.com';
var FAKE_WSS_POST_URL = 'https://foo.com';
var FAKE_ROOM_ID = 'bar';
var FAKE_CLIENT_ID = 'barbar';
var FAKE_SEND_EXCEPTION = 'Send exception';

var webSockets = [];
var MockWebSocket = function(url) {
  assertEquals(FAKE_WSS_URL, url);

  this.url = url;
  this.messages = [];
  this.readyState = WebSocket.CONNECTING;

  this.onopen = null;
  this.onclose = null;
  this.onerror = null;
  this.onmessage = null;

  webSockets.push(this);
};

MockWebSocket.CONNECTING = WebSocket.CONNECTING;
MockWebSocket.OPEN = WebSocket.OPEN;
MockWebSocket.CLOSED = WebSocket.CLOSED;

MockWebSocket.prototype.simulateOpenResult = function(success) {
  if (success) {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen();
    }
  } else {
    this.readyState = WebSocket.CLOSED;
    if (this.onerror) {
      this.onerror(Error('Mock open error'));
    }
  }
};

MockWebSocket.prototype.send = function(msg) {
  if (this.readyState !== WebSocket.OPEN) {
    throw 'Send called when the connection is not open';
  }

  if (this.throwOnSend) {
    throw FAKE_SEND_EXCEPTION;
  }

  this.messages.push(msg);
};

MockWebSocket.prototype.close = function() {
  this.readyState = WebSocket.CLOSED;
};

var xhrs = [];
var MockXMLHttpRequest = function() {
  this.url = null;
  this.method = null;
  this.async = true;
  this.body = null;
  this.readyState = 0;

  xhrs.push(this);
};
MockXMLHttpRequest.prototype.open = function(method, path, async) {
  this.url = path;
  this.method = method;
  this.async = async;
  this.readyState = 1;
};
MockXMLHttpRequest.prototype.send = function(body) {
  this.body = body;
  if (this.async) {
    this.readyState = 2;
  } else {
    this.readyState = 4;
  }
};

var MockWindowPort = function() {
  this.messages = [];
  this.onMessage_ = null;
};

MockWindowPort.prototype.addMessageListener = function(callback) {
  this.onMessage_ = callback;
};

MockWindowPort.prototype.sendMessage = function(message) {
  this.messages.push(message);
};

MockWindowPort.prototype.simulateMessageFromBackground = function(message) {
  if (this.onMessage_) {
    this.onMessage_(message);
  }
};
