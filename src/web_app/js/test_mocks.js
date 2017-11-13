/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals expect */
/* exported FAKE_CANDIDATE, FAKE_SDP,  FAKE_ICE_SERVER, FAKE_SEND_EXCEPTION,
   FAKE_WSS_POST_URL, FAKE_WSS_URL, FAKE_WSS_POST_URL, FAKE_ROOM_ID,
   FAKE_CLIENT_ID, MockWebSocket, MockXMLHttpRequest, webSockets, xhrs,
   MockWindowPort,  Mock */

'use strict';

var FAKE_WSS_URL = 'wss://foo.com';
var FAKE_WSS_POST_URL = 'https://foo.com';
var FAKE_ROOM_ID = 'bar';
var FAKE_CLIENT_ID = 'barbar';
var FAKE_SEND_EXCEPTION = 'Send exception';
var FAKE_ICE_SERVER = [
  {
    credential: 'foobar',
    urls: ['turn:192.168.1.200:19305?transport:udp'],
    username: 'barfoo',
  },
  {urls: ['stun:stun.l.google.com:19302']}
];

var FAKE_CANDIDATE = 'candidate:702786350 2 udp 41819902 8.8.8.8 60769 ' +
  'typ relay raddr 8.8.8.8 rport 1234 ' +
  'tcptype active ' +
  'ufrag abc ' +
  'generation 0';

var FAKE_SDP = 'v=0\r\n' +
  'o=- 166855176514521964 2 IN IP4 127.0.0.1\r\n' +
  's=-\r\n' +
  't=0 0\r\n' +
  'a=msid-semantic:WMS *\r\n' +
  'm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' +
  'c=IN IP4 0.0.0.0\r\n' +
  'a=rtcp:9 IN IP4 0.0.0.0\r\n' +
  'a=ice-ufrag:someufrag\r\n' +
  'a=ice-pwd:somelongpwdwithenoughrandomness\r\n' +
  'a=fingerprint:sha-256 8C:71:B3:8D:A5:38:FD:8F:A4:2E:A2:65:6C:86:52' +
  ':BC:E0:6E:94:F2:9F:7C:4D:B5:DF:AF:AA:6F:44:90:8D:F4\r\n' +
  'a=setup:actpass\r\n' +
  'a=rtcp-mux\r\n' +
  'a=mid:mid1\r\n' +
  'a=sendonly\r\n' +
  'a=rtpmap:111 opus/48000/2\r\n' +
  'a=msid:stream1 track1\r\n' +
  'a=ssrc:1001 cname:some\r\n';

var webSockets = [];
var MockWebSocket = function(url) {
  expect(url).toEqual(FAKE_WSS_URL);

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

var Mock = {};

Mock.createSendAsyncUrlRequestMock = function() {
  var calls = [];
  var fn = function(method, url, body) {
    calls.push({method: method, url: url, body: body});
    return new Promise(function() {});
  };
  fn.calls = function() {
    return calls;
  };
  return fn;
};

var xhrs = [];
var MockXMLHttpRequest = function() {
  this.url = null;
  this.method = null;
  this.async = true;
  this.body = null;
  this.readyState = 0;
  this.status = 0;

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
    this.status = 200;
  } else {
    this.readyState = 4;
    this.status = 200;
  }
};
// Clean up xhr queue for the next test.
MockXMLHttpRequest.cleanQueue = function() {
  xhrs = [];
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
