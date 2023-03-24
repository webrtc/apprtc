/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals  describe, Call, expect, it, FAKE_ICE_SERVER, beforeEach, afterEach,
   SignalingChannel:true, FAKE_WSS_POST_URL, FAKE_ROOM_ID,
   FAKE_CLIENT_ID, xhrs, MockXMLHttpRequest */

'use strict';

describe('Call test', function() {
  var FAKE_LEAVE_URL = '/leave/' + FAKE_ROOM_ID + '/' + FAKE_CLIENT_ID;
  var MEDIA_STREAM_OBJECT = {value: 'stream'};
  var realXMLHttpRequest = XMLHttpRequest;

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

  function mockRequestUserMedia() {
    return new Promise(function(resolve) {
      resolve(MEDIA_STREAM_OBJECT);
    });
  }

  beforeEach(function() {
    mockSignalingChannels = [];
    this.signalingChannelBackup_ = SignalingChannel;
    SignalingChannel = MockSignalingChannel;
    this.requestUserMediaBackup_ =
      navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = mockRequestUserMedia;

    this.params_ = {
      mediaConstraints: {
        audio: true, video: true
      },
      roomId: FAKE_ROOM_ID,
      clientId: FAKE_CLIENT_ID,
      peerConnectionConfig: {iceServers: FAKE_ICE_SERVER}
    };

    window.XMLHttpRequest = MockXMLHttpRequest;
  });

  afterEach(function() {
    SignalingChannel = this.signalingChannelBackup_;
    navigator.mediaDevices.getUserMedia = this.requestUserMediaBackup_;
    // Removes the xhrs queue.
    XMLHttpRequest.cleanQueue();
    window.XMLHttpRequest = realXMLHttpRequest;
  });

  it('Restart initializes media', function(done) {
    var call = new Call(this.params_);
    call.onlocalstreamadded = function(stream) {
      expect(stream).toEqual(MEDIA_STREAM_OBJECT);
      done();
    };
    call.restart();
  });

  it('hangup sync', function() {
    var call = new Call(this.params_);
    var stopCalled = false;
    var closeCalled = false;
    call.localStream_ = {
      stop: function() {
        stopCalled = true;
      }
    };
    call.pcClient_ = {
      close: function() {
        closeCalled = true;
      }
    };

    expect(xhrs.length).toEqual(0);
    expect(mockSignalingChannels[0].sends.length).toEqual(0);
    expect(mockSignalingChannels[0].isOpen).toBeNull();
    // var realXMLHttpRequest = XMLHttpRequest;
    // XMLHttpRequest = MockXMLHttpRequest;

    call.hangup(false);
    // XMLHttpRequest = realXMLHttpRequest;

    expect(stopCalled).toBeTruthy();
    expect(closeCalled).toBeTruthy();
    // Send /leave.
    expect(xhrs.length).toEqual(1);
    expect(xhrs[0].url).toEqual(FAKE_LEAVE_URL);
    expect(xhrs[0].method).toEqual('POST');

    expect(mockSignalingChannels.length).toEqual(1);
    // Send 'bye' to ws.
    expect(mockSignalingChannels[0].sends.length).toEqual(1);
    expect(mockSignalingChannels[0].sends[0])
        .toEqual(JSON.stringify({type: 'bye'}));

    // Close ws.
    expect(mockSignalingChannels[0].isOpen).toBeFalsy();

    // Clean up params state.
    expect(call.params_.roomId).toBeNull();
    expect(call.params_.clientId).toBeNull();
    expect(call.params_.previousRoomId).toEqual(FAKE_ROOM_ID);
  });
});
