/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals describe, done, expect, FAKE_CANDIDATE, FAKE_SDP, jasmine, it,
   beforeEach, afterEach, PeerConnectionClient */

'use strict';

describe('PeerConnectionClient Test', function() {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
  var FAKEPCCONFIG = {
    'bar': 'foo'
  };
  var FAKEPCCONSTRAINTS = {
    'foo': 'bar'
  };

  var peerConnections = [];
  var MockRTCPeerConnection = function(config, constraints) {
    this.config = config;
    this.constraints = constraints;
    this.streams = [];
    this.createSdpRequests = [];
    this.localDescriptions = [];
    this.remoteDescriptions = [];
    this.remoteIceCandidates = [];
    this.signalingState = 'stable';

    peerConnections.push(this);
  };
  MockRTCPeerConnection.prototype.addStream = function(stream) {
    this.streams.push(stream);
  };
  MockRTCPeerConnection.prototype.createOffer = function(constraints) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.createSdpRequests.push({
        type: 'offer',
        callback: resolve,
        errback: reject,
        constraints: constraints
      });
    });
  };
  MockRTCPeerConnection.prototype.createAnswer = function(constraints) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.createSdpRequests.push({
        type: 'answer',
        callback: resolve,
        errback: reject,
        constraints: constraints
      });
    });
  };
  MockRTCPeerConnection.prototype.resolveLastCreateSdpRequest = function(sdp) {
    var request = this.createSdpRequests.pop();
    expect(request).toBeDefined();
    if (sdp) {
      request.callback({
        'type': request.type,
        'sdp': sdp
      });
    } else {
      request.errback(Error('MockCreateSdpError'));
    }
  };
  MockRTCPeerConnection.prototype.onlocaldescription = function() {};
  MockRTCPeerConnection.prototype.setLocalDescription =
      function(localDescription) {
        var self = this;

        if (localDescription.type === 'offer') {
          this.signalingState = 'have-local-offer';
        } else {
          this.signalingState = 'stable';
        }
        return new Promise(function(resolve, reject) {
          self.localDescriptions.push({
            description: localDescription,
            callback: resolve,
            errback: reject
          });
          resolve(self.onlocaldescription());
        });
      };
  MockRTCPeerConnection.prototype.onremotedescription = function() {};
  MockRTCPeerConnection.prototype.setRemoteDescription =
      function(remoteDescription) {
        var self = this;
        if (remoteDescription.type === 'offer') {
          this.signalingState = 'have-remote-offer';
        } else {
          this.signalingState = 'stable';
        }
        return new Promise(function(resolve, reject) {
          self.remoteDescriptions.push({
            description: remoteDescription,
            callback: resolve,
            errback: reject
          });
          resolve(self.onremotedescription());
        });
      };
  MockRTCPeerConnection.prototype.addIceCandidate = function(candidate) {
    this.remoteIceCandidates.push(candidate);
    return new Promise(function(resolve) {
      resolve();
    });
  };
  MockRTCPeerConnection.prototype.close = function() {
    this.signalingState = 'closed';
  };
  MockRTCPeerConnection.prototype.getRemoteStreams = function() {
    return [{
      getVideoTracks: function() {
        return ['track'];
      }
    }];
  };

  function getParams(pcConfig, pcConstraints) {
    return {
      'peerConnectionConfig': pcConfig,
      'peerConnectionConstraints': pcConstraints
    };
  }

  beforeEach(function() {
    window.params = {};

    this.realRTCPeerConnection = window.RTCPeerConnection;
    window.RTCPeerConnection = MockRTCPeerConnection;

    this.pcClient = new PeerConnectionClient(
        getParams(FAKEPCCONFIG, FAKEPCCONSTRAINTS), window.performance.now());
  });

  afterEach(function() {
    peerConnections = [];
    window.RTCPeerConnection = this.realRTCPeerConnection;
    this.pcClient.close();
    this.pcClient = null;
  });

  it('Constructor', function() {
    expect(peerConnections.length).toEqual(1);
    expect(peerConnections[0].config).toEqual(FAKEPCCONFIG);
    expect(peerConnections[0].constraints).toEqual(FAKEPCCONSTRAINTS);
  });

  it('Add stream', function() {
    var stream = {'foo': 'bar'};
    this.pcClient.addStream(stream);
    expect(peerConnections[0].streams.length).toEqual(1);
    expect(peerConnections[0].streams[0]).toEqual(stream);
  });

  it('Start as a caller', function(done) {
    var pc = peerConnections[0];
    var self = this;
    var candidate = {
      type: 'candidate',
      label: 0,
      candidate: FAKE_CANDIDATE
    };
    var remoteAnswer = {
      type: 'answer',
      sdp: 'fake answer'
    };

    pc.onlocaldescription = function() {
      self.pcClient.receiveSignalingMessage(JSON.stringify(remoteAnswer));
    };

    pc.onremotedescription = function() {
      expect(pc.remoteDescriptions.length).toEqual(1);
      expect(pc.remoteDescriptions[0].description.type).toEqual('answer');
      expect(pc.remoteDescriptions[0].description.sdp)
          .toEqual(remoteAnswer.sdp);
    };

    pc.onlocaldescription = function() {
      self.pcClient.receiveSignalingMessage(JSON.stringify(remoteAnswer));
      self.pcClient.receiveSignalingMessage(JSON.stringify(candidate));
    };

    this.pcClient.onsignalingmessage = function(event) {
      expect(pc.remoteIceCandidates.length).toEqual(1);
      expect(pc.remoteIceCandidates[0].sdpMLineIndex).toEqual(candidate.label);
      expect(pc.remoteIceCandidates[0].candidate).toEqual(candidate.candidate);
      if (event.type === 'offer') {
        done();
      }
    };

    expect(this.pcClient.startAsCaller(null)).toBeTruthy();
    pc.resolveLastCreateSdpRequest('fake offer');
  });

  it('Start as callee', function(done) {
    var pc = peerConnections[0];

    var remoteOffer = {
      type: 'offer',
      sdp: FAKE_SDP
    };
    var candidate = {
      type: 'candidate',
      label: 0,
      candidate: FAKE_CANDIDATE
    };
    var initialMsgs = [
      JSON.stringify(candidate),
      JSON.stringify(remoteOffer)
    ];
    this.pcClient.startAsCallee(initialMsgs);

    pc.onremotedescription = function() {
      // Verify that createAnswer is called.
      expect(pc.createSdpRequests.length).toEqual(1);
      expect(pc.createSdpRequests[0].type).toEqual('answer');

      var fakeAnswer = 'fake answer';
      pc.resolveLastCreateSdpRequest(fakeAnswer);
    };

    pc.onlocaldescription = function() {
      // Verify that setLocalDescription is called.
      expect(pc.localDescriptions.length).toEqual(1);
      expect(pc.localDescriptions[0].description.type).toEqual('answer');
      expect(pc.localDescriptions[0].description.sdp).toEqual(fakeAnswer);
      // Verify that remote offer and ICE candidates are set.
      expect(pc.remoteDescriptions.length).toEqual(1);
      expect(pc.remoteDescriptions[0].description.type).toEqual('offer');
      expect(pc.remoteDescriptions[0].description.sdp).toEqual(remoteOffer.sdp);
      expect(pc.remoteIceCandidates.length).toEqual(1);
      expect(pc.remoteIceCandidates[0].sdpMLineIndex).toEqual(candidate.label);
      expect(pc.remoteIceCandidates[0].candidate).toEqual(candidate.candidate);

      // Verify that setLocalDescription is called.
      expect(pc.localDescriptions.length).toEqual(1);
      expect(pc.localDescriptions[0].description.type).toEqual('answer');
      expect(pc.localDescriptions[0].description.sdp).toEqual(fakeAnswer);
      done();
    };

    var fakeAnswer = 'fake answer';
    pc.resolveLastCreateSdpRequest(fakeAnswer);
  });

  it('Receive remote offer before started', function() {
    var remoteOffer = {
      type: 'offer',
      sdp: FAKE_CANDIDATE
    };
    this.pcClient.receiveSignalingMessage(JSON.stringify(remoteOffer));
    this.pcClient.startAsCallee(null);

    // Verify that the offer received before started is processed.
    var pc = peerConnections[0];
    expect(pc.remoteDescriptions.length).toEqual(1);
    expect(pc.remoteDescriptions[0].description.type).toEqual('offer');
    expect(pc.remoteDescriptions[0].description.sdp).toEqual(remoteOffer.sdp);
  });

  it('Remote hangup', function(done) {
    this.pcClient.onremotehangup = done;

    this.pcClient.receiveSignalingMessage(JSON.stringify({
      type: 'bye'
    }));
  });

  it('On remote SDP set', function(done) {
    var pc = peerConnections[0];
    this.pcClient.onremotesdpset = function() {
      var callback = pc.remoteDescriptions[0].callback;
      expect(callback).toBeDefined();
      callback();
      done();
    };

    var remoteOffer = {
      type: 'offer',
      sdp: FAKE_SDP
    };
    var initialMsgs = [JSON.stringify(remoteOffer)];
    expect(this.pcClient.startAsCallee(initialMsgs)).toBeTruthy();
  });

  it('On remote stream added', function() {
    var stream = 'stream';
    var event = {
      stream: 'stream'
    };
    this.pcClient.onremotestreamadded = function(event) {
      expect(stream).toEqual(event.stream);
      done();
    };
    peerConnections[0].addStream(event);
  });

  it('On signaling state change', function(done) {
    this.pcClient.onsignalingstatechange = done;
    peerConnections[0].onsignalingstatechange();
  });

  it('On ICE connection state change', function(done) {
    this.pcClient.oniceconnectionstatechange = done;
    peerConnections[0].oniceconnectionstatechange();
  });

  it('Start as a caller twice failed', function() {
    expect(this.pcClient.startAsCaller(null)).toBeTruthy();
    expect(this.pcClient.startAsCaller(null)).toBeFalsy();
  });

  it('Close peerConnection', function() {
    this.pcClient.close();
    expect(peerConnections[0].signalingState).toEqual('closed');
  });
});
