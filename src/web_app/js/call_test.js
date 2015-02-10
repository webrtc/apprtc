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
   FAKE_CLIENT_ID, WindowPort:true, Constants */

'use strict';

var MEDIA_STREAM_OBJECT = {value: 'stream'};

var MockSignalingChannel = function() {
};

MockSignalingChannel.prototype.open = function() {
  return Promise.resolve();
};

MockSignalingChannel.prototype.getWssPostUrl = function() {
  return FAKE_WSS_POST_URL;
};

var CallTest = new TestCase('CallTest');

function mockRequestUserMedia() {
  return new Promise(function(resolve) {
    resolve(MEDIA_STREAM_OBJECT);
  });
}

CallTest.prototype.setUp = function() {
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
  var realWindowPort = WindowPort;
  WindowPort = new MockWindowPort();

  var call = new Call(this.params_);
  assertEquals(0, WindowPort.messages.length);
  call.queueCleanupMessages_();
  assertEquals(3, WindowPort.messages.length);

  var verifyXhrMessage = function(message, method, url) {
    assertEquals(Constants.QUEUEADD_ACTION, message.action);
    assertEquals(Constants.XHR_ACTION, message.queueMessage.action);
    assertEquals(method, message.queueMessage.method);
    assertEquals(url, message.queueMessage.url);
    assertEquals(null, message.queueMessage.body);
  };

  verifyXhrMessage(WindowPort.messages[0], 'POST', '/leave/' + FAKE_ROOM_ID +
      '/' + FAKE_CLIENT_ID);
  verifyXhrMessage(WindowPort.messages[2], 'DELETE', FAKE_WSS_POST_URL);

  var message = WindowPort.messages[1];
  assertEquals(Constants.QUEUEADD_ACTION, message.action);
  assertEquals(Constants.WS_ACTION, message.queueMessage.action);
  assertEquals(Constants.WS_SEND_ACTION, message.queueMessage.wsAction);
  var data = JSON.parse(message.queueMessage.data);
  assertEquals('send', data.cmd);
  var msg = JSON.parse(data.msg);
  assertEquals('bye', msg.type);

  WindowPort = realWindowPort;
};

CallTest.prototype.testClearCleanupQueue = function() {
  var realWindowPort = WindowPort;
  WindowPort = new MockWindowPort();

  var call = new Call(this.params_);
  call.queueCleanupMessages_();
  assertEquals(3, WindowPort.messages.length);

  call.clearCleanupQueue_();
  assertEquals(4, WindowPort.messages.length);
  var message = WindowPort.messages[3];
  assertEquals(Constants.QUEUECLEAR_ACTION, message.action);

  WindowPort = realWindowPort;
};
