/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals TestCase, assertEquals, assertNotNull, assertTrue, assertFalse,
   WebSocket:true, XMLHttpRequest:true, SignalingChannel, webSockets:true,
   xhrs:true, FAKE_WSS_URL, FAKE_WSS_POST_URL, FAKE_ROOM_ID, FAKE_CLIENT_ID,
   MockXMLHttpRequest, MockWebSocket */

'use strict';

var SignalingChannelTest = new TestCase('SignalingChannelTest');

SignalingChannelTest.prototype.setUp = function() {
  webSockets = [];
  xhrs = [];

  this.realWebSocket = WebSocket;
  WebSocket = MockWebSocket;

  this.channel =
      new SignalingChannel(FAKE_WSS_URL, FAKE_WSS_POST_URL);
};

SignalingChannelTest.prototype.tearDown = function() {
  WebSocket = this.realWebSocket;
};

SignalingChannelTest.prototype.testOpenSuccess = function() {
  var promise = this.channel.open();
  assertEquals(1, webSockets.length);

  var resolved = false;
  var rejected = false;
  promise.then(function() {
    resolved = true;
  }).catch (function() {
    rejected = true;
  });

  var socket = webSockets[0];
  socket.simulateOpenResult(true);
  assertTrue(resolved);
  assertFalse(rejected);
};

SignalingChannelTest.prototype.testReceiveMessage = function() {
  this.channel.open();
  var socket = webSockets[0];
  socket.simulateOpenResult(true);

  assertNotNull(socket.onmessage);

  var msgs = [];
  this.channel.onmessage = function(msg) {
    msgs.push(msg);
  };

  var expectedMsg = 'hi';
  var event = {
    'data': JSON.stringify({'msg': expectedMsg})
  };
  socket.onmessage(event);
  assertEquals(1, msgs.length);
  assertEquals(expectedMsg, msgs[0]);
};

SignalingChannelTest.prototype.testOpenFailure = function() {
  var promise = this.channel.open();
  assertEquals(1, webSockets.length);

  var resolved = false;
  var rejected = false;
  promise.then(function() {
    resolved = true;
  }).catch (function() {
    rejected = true;
  });

  var socket = webSockets[0];
  socket.simulateOpenResult(false);
  assertFalse(resolved);
  assertTrue(rejected);
};

SignalingChannelTest.prototype.testRegisterBeforeOpen = function() {
  this.channel.open();
  this.channel.register(FAKE_ROOM_ID, FAKE_CLIENT_ID);

  var socket = webSockets[0];
  socket.simulateOpenResult(true);

  assertEquals(1, socket.messages.length);

  var registerMessage = {
    cmd: 'register',
    roomid: FAKE_ROOM_ID,
    clientid: FAKE_CLIENT_ID
  };
  assertEquals(JSON.stringify(registerMessage), socket.messages[0]);
};

SignalingChannelTest.prototype.testRegisterAfterOpen = function() {
  this.channel.open();
  var socket = webSockets[0];
  socket.simulateOpenResult(true);
  this.channel.register(FAKE_ROOM_ID, FAKE_CLIENT_ID);

  assertEquals(1, socket.messages.length);

  var registerMessage = {
    cmd: 'register',
    roomid: FAKE_ROOM_ID,
    clientid: FAKE_CLIENT_ID
  };
  assertEquals(JSON.stringify(registerMessage), socket.messages[0]);
};

SignalingChannelTest.prototype.testSendBeforeOpen = function() {
  // Stubbing XMLHttpRequest cannot be done in setUp since it caused PhantomJS
  // to hang.
  var realXMLHttpRequest = XMLHttpRequest;
  XMLHttpRequest = MockXMLHttpRequest;

  this.channel.open();
  this.channel.register(FAKE_ROOM_ID, FAKE_CLIENT_ID);

  var message = 'hello';
  this.channel.send(message);

  assertEquals(1, xhrs.length);
  assertEquals(2, xhrs[0].readyState);
  assertEquals(FAKE_WSS_POST_URL + '/' + FAKE_ROOM_ID + '/' + FAKE_CLIENT_ID,
               xhrs[0].url);
  assertEquals('POST', xhrs[0].method);
  assertEquals(message, xhrs[0].body);

  XMLHttpRequest = realXMLHttpRequest;
};

SignalingChannelTest.prototype.testSendAfterOpen = function() {
  this.channel.open();
  var socket = webSockets[0];
  socket.simulateOpenResult(true);
  this.channel.register(FAKE_ROOM_ID, FAKE_CLIENT_ID);

  var message = 'hello';
  var wsMessage = {
    cmd: 'send',
    msg: message
  };
  this.channel.send(message);
  assertEquals(2, socket.messages.length);
  assertEquals(JSON.stringify(wsMessage), socket.messages[1]);
};

SignalingChannelTest.prototype.testCloseAfterRegister = function() {
  var realXMLHttpRequest = XMLHttpRequest;
  XMLHttpRequest = MockXMLHttpRequest;

  this.channel.open();
  var socket = webSockets[0];
  socket.simulateOpenResult(true);
  this.channel.register(FAKE_ROOM_ID, FAKE_CLIENT_ID);

  assertEquals(WebSocket.OPEN, socket.readyState);
  this.channel.close();
  assertEquals(WebSocket.CLOSED, socket.readyState);

  assertEquals(1, xhrs.length);
  assertEquals(4, xhrs[0].readyState);
  assertEquals(FAKE_WSS_POST_URL + '/' + FAKE_ROOM_ID + '/' + FAKE_CLIENT_ID,
               xhrs[0].url);
  assertEquals('DELETE', xhrs[0].method);

  XMLHttpRequest = realXMLHttpRequest;
};

SignalingChannelTest.prototype.testCloseBeforeRegister = function() {
  var realXMLHttpRequest = XMLHttpRequest;
  XMLHttpRequest = MockXMLHttpRequest;

  this.channel.open();
  this.channel.close();

  assertEquals(0, xhrs.length);
  XMLHttpRequest = realXMLHttpRequest;
};
