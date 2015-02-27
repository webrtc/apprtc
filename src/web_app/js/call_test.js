/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals TestCase, SignalingChannel:true, requestUserMedia:true,
   assertEquals, assertTrue, MockWindowPort, FAKE_WSS_POST_URL, FAKE_ROOM_ID,
   FAKE_CLIENT_ID, apprtc, Constants, xhrs, MockXMLHttpRequest, assertFalse,
   XMLHttpRequest:true */

'use strict';

var FAKE_LEAVE_URL = '/leave/' + FAKE_ROOM_ID + '/' + FAKE_CLIENT_ID;
var MEDIA_STREAM_OBJECT = {value: 'stream'};

var mockSignalingChannels = [];

var MockSignalingChannel = function() {
  this.isOpen = null;
  this.sends = [];
  mockSignalingChannels.push(this);
};

MockSignalingChannel.prototype.open = function() {
  this.isOpen = true;
  return Promise.resolve();
};

MockSignalingChannel.prototype.getWssPostUrl = function() {
  return FAKE_WSS_POST_URL;
};

MockSignalingChannel.prototype.send = function(data) {
  this.sends.push(data);
};

MockSignalingChannel.prototype.close = function() {
  this.isOpen = false;
};

var CallTest = new TestCase('CallTest');

function mockRequestUserMedia() {
  return new Promise(function(resolve) {
    resolve(MEDIA_STREAM_OBJECT);
  });
}

CallTest.prototype.setUp = function() {
  mockSignalingChannels = [];
  this.signalingChannelBackup_ = SignalingChannel;
  SignalingChannel = MockSignalingChannel;
  this.requestUserMediaBackup_ = requestUserMedia;
  requestUserMedia = mockRequestUserMedia;

  this.params_ = {
    mediaConstraints: {
      audio: true, video: true
    },
    roomId: FAKE_ROOM_ID,
    clientId: FAKE_CLIENT_ID
  };
};

CallTest.prototype.tearDown = function() {
  SignalingChannel = this.signalingChannelBackup_;
  requestUserMedia = this.requestUserMediaBackup_;
};

CallTest.prototype.testRestartInitializesMedia = function() {
  var call = new Call(this.params_);
  var mediaStarted = false;
  call.onlocalstreamadded = function(stream) {
    mediaStarted = true;
    assertEquals(MEDIA_STREAM_OBJECT, stream);
  };
  call.restart();
  assertTrue(mediaStarted);
};

CallTest.prototype.testSetUpCleanupQueue = function() {
  var realWindowPort = apprtc.windowPort;
  apprtc.windowPort = new MockWindowPort();

  var call = new Call(this.params_);
  assertEquals(0, apprtc.windowPort.messages.length);
  call.queueCleanupMessages_();
  assertEquals(3, apprtc.windowPort.messages.length);

  var verifyXhrMessage = function(message, method, url) {
    assertEquals(Constants.QUEUEADD_ACTION, message.action);
    assertEquals(Constants.XHR_ACTION, message.queueMessage.action);
    assertEquals(method, message.queueMessage.method);
    assertEquals(url, message.queueMessage.url);
    assertEquals(null, message.queueMessage.body);
  };

  verifyXhrMessage(apprtc.windowPort.messages[0], 'POST', FAKE_LEAVE_URL);
  verifyXhrMessage(apprtc.windowPort.messages[2], 'DELETE',
      FAKE_WSS_POST_URL);

  var message = apprtc.windowPort.messages[1];
  assertEquals(Constants.QUEUEADD_ACTION, message.action);
  assertEquals(Constants.WS_ACTION, message.queueMessage.action);
  assertEquals(Constants.WS_SEND_ACTION, message.queueMessage.wsAction);
  var data = JSON.parse(message.queueMessage.data);
  assertEquals('send', data.cmd);
  var msg = JSON.parse(data.msg);
  assertEquals('bye', msg.type);

  apprtc.windowPort = realWindowPort;
};

CallTest.prototype.testClearCleanupQueue = function() {
  var realWindowPort = apprtc.windowPort;
  apprtc.windowPort = new MockWindowPort();

  var call = new Call(this.params_);
  call.queueCleanupMessages_();
  assertEquals(3, apprtc.windowPort.messages.length);

  call.clearCleanupQueue_();
  assertEquals(4, apprtc.windowPort.messages.length);
  var message = apprtc.windowPort.messages[3];
  assertEquals(Constants.QUEUECLEAR_ACTION, message.action);

  apprtc.windowPort = realWindowPort;
};

CallTest.prototype.testCallHangupSync = function() {
  var call = new Call(this.params_);
  var stopCalled = false;
  var closeCalled = false;
  call.localStream_ = {stop: function() {stopCalled = true; }};
  call.pcClient_ = {close: function() {closeCalled = true; }};

  assertEquals(0, xhrs.length);
  assertEquals(0, mockSignalingChannels[0].sends.length);
  assertTrue(mockSignalingChannels[0].isOpen !== false);
  var realXMLHttpRequest = XMLHttpRequest;
  XMLHttpRequest = MockXMLHttpRequest;

  call.hangup(false);
  XMLHttpRequest = realXMLHttpRequest;

  assertEquals(true, stopCalled);
  assertEquals(true, closeCalled);
  // Send /leave.
  assertEquals(1, xhrs.length);
  assertEquals(FAKE_LEAVE_URL, xhrs[0].url);
  assertEquals('POST', xhrs[0].method);

  assertEquals(1, mockSignalingChannels.length);
  // Send 'bye' to ws.
  assertEquals(1, mockSignalingChannels[0].sends.length);
  assertEquals(JSON.stringify({type: 'bye'}),
      mockSignalingChannels[0].sends[0]);

  // Close ws.
  assertFalse(mockSignalingChannels[0].isOpen);

  // Clean up params state.
  assertEquals(null, call.params_.roomId);
  assertEquals(null, call.params_.clientId);
  assertEquals(FAKE_ROOM_ID, call.params_.previousRoomId);
};
