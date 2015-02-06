/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals TestCase, SignalingChannel:true, requestUserMedia:true,
   assertEquals, assertTrue */

'use strict';

var MEDIA_STREAM_OBJECT = {value: 'stream'};

var MockSignalingChannel = function() {
};

MockSignalingChannel.prototype.open = function() {
  return Promise.resolve();
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
    }
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
