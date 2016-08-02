/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals trace, mergeConstraints, parseJSON, iceCandidateType,
   maybePreferAudioReceiveCodec, maybePreferVideoReceiveCodec,
   maybePreferAudioSendCodec, maybePreferVideoSendCodec,
   maybeSetAudioSendBitRate, maybeSetVideoSendBitRate,
   maybeSetAudioReceiveBitRate, maybeSetVideoSendInitialBitRate,
   maybeSetVideoReceiveBitRate, maybeSetVideoSendInitialBitRate,
   maybeRemoveVideoFec, maybeSetOpusOptions, jsSHA, io, callstats,
   DOMException */

/* exported PeerConnectionClient */

// TODO(jansson) disabling for now since we are going replace JSHINT.
// (It does not say where the strict violation is hence it's not worth fixing.).
// jshint strict:false

'use strict';

var PeerConnectionClient = function(params, startTime) {
  this.params_ = params;
  this.startTime_ = startTime;

  trace('Creating RTCPeerConnnection with:\n' +
    '  config: \'' + JSON.stringify(params.peerConnectionConfig) + '\';\n' +
    '  constraints: \'' + JSON.stringify(params.peerConnectionConstraints) +
    '\'.');

  // Create an RTCPeerConnection via the polyfill (adapter.js).
  this.pc_ = new RTCPeerConnection(
      params.peerConnectionConfig, params.peerConnectionConstraints);
  this.pc_.onicecandidate = this.onIceCandidate_.bind(this);
  this.pc_.ontrack = this.onRemoteStreamAdded_.bind(this);
  this.pc_.onremovestream = trace.bind(null, 'Remote stream removed.');
  this.pc_.onsignalingstatechange = this.onSignalingStateChanged_.bind(this);
  this.pc_.oniceconnectionstatechange =
      this.onIceConnectionStateChanged_.bind(this);

  this.hasRemoteSdp_ = false;
  this.messageQueue_ = [];
  this.isInitiator_ = false;
  this.started_ = false;

  // TODO(jiayl): Replace callbacks with events.
  // Public callbacks. Keep it sorted.
  this.onerror = null;
  this.oniceconnectionstatechange = null;
  this.onnewicecandidate = null;
  this.onremotehangup = null;
  this.onremotesdpset = null;
  this.onremotestreamadded = null;
  this.onsignalingmessage = null;
  this.onsignalingstatechange = null;

  this.callstatsInit = false;
};

// Set up audio and video regardless of what devices are present.
// Disable comfort noise for maximum audio quality.
PeerConnectionClient.DEFAULT_SDP_OFFER_OPTIONS_ = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1,
  voiceActivityDetection: false
};

PeerConnectionClient.prototype.addStream = function(stream) {
  if (!this.pc_) {
    return;
  }
  this.pc_.addStream(stream);
};

PeerConnectionClient.prototype.startAsCaller = function(offerOptions) {
  if (!this.pc_) {
    return false;
  }

  if (this.started_) {
    return false;
  }

  this.isInitiator_ = true;
  this.setupCallstats_();
  this.started_ = true;
  var constraints = mergeConstraints(
    PeerConnectionClient.DEFAULT_SDP_OFFER_OPTIONS_, offerOptions);
  trace('Sending offer to peer, with constraints: \n\'' +
      JSON.stringify(constraints) + '\'.');
  this.pc_.createOffer(constraints)
  .then(this.setLocalSdpAndNotify_.bind(this))
  .catch(this.onError_.bind(this, 'createOffer'));

  return true;
};

PeerConnectionClient.prototype.startAsCallee = function(initialMessages) {
  if (!this.pc_) {
    return false;
  }

  if (this.started_) {
    return false;
  }

  this.isInitiator_ = false;
  this.setupCallstats_();
  this.started_ = true;

  if (initialMessages && initialMessages.length > 0) {
    // Convert received messages to JSON objects and add them to the message
    // queue.
    for (var i = 0, len = initialMessages.length; i < len; i++) {
      this.receiveSignalingMessage(initialMessages[i]);
    }
    return true;
  }

  // We may have queued messages received from the signaling channel before
  // started.
  if (this.messageQueue_.length > 0) {
    this.drainMessageQueue_();
  }
  return true;
};

PeerConnectionClient.prototype.receiveSignalingMessage = function(message) {
  var messageObj = parseJSON(message);
  if (!messageObj) {
    return;
  }
  if ((this.isInitiator_ && messageObj.type === 'answer') ||
      (!this.isInitiator_ && messageObj.type === 'offer')) {
    this.hasRemoteSdp_ = true;
    // Always process offer before candidates.
    this.messageQueue_.unshift(messageObj);
  } else if (messageObj.type === 'candidate') {
    this.messageQueue_.push(messageObj);
  } else if (messageObj.type === 'bye') {
    if (this.onremotehangup) {
      this.onremotehangup();
    }
  }
  this.drainMessageQueue_();
};

PeerConnectionClient.prototype.close = function() {
  if (!this.pc_) {
    return;
  }

  this.sendCallstatsEvents('fabricTerminated');
  this.pc_.close();
  this.pc_ = null;
  this.callstatsInit = false;
};

PeerConnectionClient.prototype.getPeerConnectionStates = function() {
  if (!this.pc_) {
    return null;
  }
  return {
    'signalingState': this.pc_.signalingState,
    'iceGatheringState': this.pc_.iceGatheringState,
    'iceConnectionState': this.pc_.iceConnectionState
  };
};

PeerConnectionClient.prototype.getPeerConnectionStats = function(callback) {
  if (!this.pc_) {
    return;
  }
  this.pc_.getStats(null)
  .then(callback);
};

PeerConnectionClient.prototype.doAnswer_ = function() {
  trace('Sending answer to peer.');
  this.pc_.createAnswer()
  .then(this.setLocalSdpAndNotify_.bind(this))
  .catch(this.onError_.bind(this, 'createAnswer'));
};

PeerConnectionClient.prototype.setLocalSdpAndNotify_ =
    function(sessionDescription) {
  sessionDescription.sdp = maybePreferAudioReceiveCodec(
    sessionDescription.sdp,
    this.params_);
  sessionDescription.sdp = maybePreferVideoReceiveCodec(
    sessionDescription.sdp,
    this.params_);
  sessionDescription.sdp = maybeSetAudioReceiveBitRate(
    sessionDescription.sdp,
    this.params_);
  sessionDescription.sdp = maybeSetVideoReceiveBitRate(
    sessionDescription.sdp,
    this.params_);
  sessionDescription.sdp = maybeRemoveVideoFec(
    sessionDescription.sdp,
    this.params_);
  this.pc_.setLocalDescription(sessionDescription)
  .then(trace.bind(null, 'Set session description success.'))
  .catch(this.onError_.bind(this, 'setLocalDescription'));

  if (this.onsignalingmessage) {
    // Chrome version of RTCSessionDescription can't be serialized directly
    // because it JSON.stringify won't include attributes which are on the
    // object's prototype chain. By creating the message to serialize explicitly
    // we can avoid the issue.
    this.onsignalingmessage({
      sdp: sessionDescription.sdp,
      type: sessionDescription.type
    });
  }
};

PeerConnectionClient.prototype.setRemoteSdp_ = function(message) {
  message.sdp = maybeSetOpusOptions(message.sdp, this.params_);
  message.sdp = maybePreferAudioSendCodec(message.sdp, this.params_);
  message.sdp = maybePreferVideoSendCodec(message.sdp, this.params_);
  message.sdp = maybeSetAudioSendBitRate(message.sdp, this.params_);
  message.sdp = maybeSetVideoSendBitRate(message.sdp, this.params_);
  message.sdp = maybeSetVideoSendInitialBitRate(message.sdp, this.params_);
  message.sdp = maybeRemoveVideoFec(message.sdp, this.params_);
  this.pc_.setRemoteDescription(new RTCSessionDescription(message))
  .then(this.onSetRemoteDescriptionSuccess_.bind(this))
  .catch(this.onError_.bind(this, 'setRemoteDescription'));
};

PeerConnectionClient.prototype.onSetRemoteDescriptionSuccess_ = function() {
  trace('Set remote session description success.');
  // By now all onaddstream events for the setRemoteDescription have fired,
  // so we can know if the peer has any remote video streams that we need
  // to wait for. Otherwise, transition immediately to the active state.
  var remoteStreams = this.pc_.getRemoteStreams();
  if (this.onremotesdpset) {
    this.onremotesdpset(remoteStreams.length > 0 &&
                        remoteStreams[0].getVideoTracks().length > 0);
  }
};

PeerConnectionClient.prototype.processSignalingMessage_ = function(message) {
  if (message.type === 'offer' && !this.isInitiator_) {
    if (this.pc_.signalingState !== 'stable') {
      trace('ERROR: remote offer received in unexpected state: ' +
            this.pc_.signalingState);
      return;
    }
    this.setRemoteSdp_(message);
    this.doAnswer_();
  } else if (message.type === 'answer' && this.isInitiator_) {
    if (this.pc_.signalingState !== 'have-local-offer') {
      trace('ERROR: remote answer received in unexpected state: ' +
            this.pc_.signalingState);
      return;
    }
    this.setRemoteSdp_(message);
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    this.recordIceCandidate_('Remote', candidate);
    this.pc_.addIceCandidate(candidate)
    .then(trace.bind(null, 'Remote candidate added successfully.'))
    .catch(this.onError_.bind(this, 'addIceCandidate'));
  } else {
    trace('WARNING: unexpected message: ' + JSON.stringify(message));
  }
};

// When we receive messages from GAE registration and from the WSS connection,
// we add them to a queue and drain it if conditions are right.
PeerConnectionClient.prototype.drainMessageQueue_ = function() {
  // It's possible that we finish registering and receiving messages from WSS
  // before our peer connection is created or started. We need to wait for the
  // peer connection to be created and started before processing messages.
  //
  // Also, the order of messages is in general not the same as the POST order
  // from the other client because the POSTs are async and the server may handle
  // some requests faster than others. We need to process offer before
  // candidates so we wait for the offer to arrive first if we're answering.
  // Offers are added to the front of the queue.
  if (!this.pc_ || !this.started_ || !this.hasRemoteSdp_) {
    return;
  }
  for (var i = 0, len = this.messageQueue_.length; i < len; i++) {
    this.processSignalingMessage_(this.messageQueue_[i]);
  }
  this.messageQueue_ = [];
};

PeerConnectionClient.prototype.onIceCandidate_ = function(event) {
  if (event.candidate) {
    // Eat undesired candidates.
    if (this.filterIceCandidate_(event.candidate)) {
      var message = {
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      };
      if (this.onsignalingmessage) {
        this.onsignalingmessage(message);
      }
      this.recordIceCandidate_('Local', event.candidate);
    }
  } else {
    trace('End of candidates.');
  }
};

PeerConnectionClient.prototype.onSignalingStateChanged_ = function() {
  if (!this.pc_) {
    return;
  }
  trace('Signaling state changed to: ' + this.pc_.signalingState);

  if (this.onsignalingstatechange) {
    this.onsignalingstatechange();
  }
};

PeerConnectionClient.prototype.onIceConnectionStateChanged_ = function() {
  if (!this.pc_) {
    return;
  }
  trace('ICE connection state changed to: ' + this.pc_.iceConnectionState);
  if (this.pc_.iceConnectionState === 'completed') {
    trace('ICE complete time: ' +
        (window.performance.now() - this.startTime_).toFixed(0) + 'ms.');
  }

  if (this.oniceconnectionstatechange) {
    this.oniceconnectionstatechange();
  }

  if (this.pc_.iceConnectionState === 'connected' && !this.isInitiator_ ||
      this.pc_.iceConnectionState === 'completed') {
    this.callStatsCommandQueue_
        .addToQueue(this.bindMstToUserIdForCallstats_.bind(this));
  }

};

// Return false if the candidate should be dropped, true if not.
PeerConnectionClient.prototype.filterIceCandidate_ = function(candidateObj) {
  var candidateStr = candidateObj.candidate;

  // Always eat TCP candidates. Not needed in this context.
  if (candidateStr.indexOf('tcp') !== -1) {
    return false;
  }

  // If we're trying to eat non-relay candidates, do that.
  if (this.params_.peerConnectionConfig.iceTransports === 'relay' &&
      iceCandidateType(candidateStr) !== 'relay') {
    return false;
  }

  return true;
};

PeerConnectionClient.prototype.recordIceCandidate_ =
    function(location, candidateObj) {
  if (this.onnewicecandidate) {
    this.onnewicecandidate(location, candidateObj.candidate);
  }
};

PeerConnectionClient.prototype.onRemoteStreamAdded_ = function(event) {
  if (this.onremotestreamadded) {
    this.onremotestreamadded(event.streams[0]);
  }
};

PeerConnectionClient.prototype.onError_ = function(tag, error) {
  if (this.onerror) {
    this.onerror(tag + ': ' + error.toString());
    this.reportErrorToCallstats(tag, error);
  }
};

PeerConnectionClient.prototype.isCallstatsInitialized_ = function() {
  if (!this.callstats && !this.callstatsInit) {
    trace('Callstats not initilized.');
    return false;
  } else {
    return true;
  }
};

// Cue for commands to send to callStats after the SDK has been authenticated.
PeerConnectionClient.prototype.callStatsCommandQueue_ = {
  queue: [],
  addToQueue: function(command) {
    if (typeof command === 'function') {
      this.queue.push(command);
    }
  },
  processQueue: function() {
    for (var i = 0; i < this.queue.length; i++) {
      var command = this.queue.pop();
      command();
    }
  }
};

PeerConnectionClient.prototype.reportErrorToCallstats =
    function(funcName, error) {
  if (!this.isCallstatsInitialized_()) {
    return;
  }
  var localSdp = this.pc_.localDescription.sdp || null;
  var remoteSdp = this.pc_.remoteDescription.sdp || null;
  // Enumerate supported callstats error types.
  // http://www.callstats.io/api/#enumeration-of-wrtcfuncnames
  var supportedWebrtcFuncNames = {
    getUserMedia: 'getUserMedia',
    createOffer: 'createOffer',
    createAnswer: 'createAnswer',
    setLocalDescription: 'setLocalDescription',
    setRemoteDescription: 'setRemoteDescription',
    addIceCandidate: 'addIceCandidate'
  };

  // Only report supported error types to the callstats backend.
  if (supportedWebrtcFuncNames[funcName]) {
    // Some error objects (gUM) have meaningful info in the name
    // property/getter.
    var filteredError = (funcName === 'getUserMedia' ? error.name : error);
    this.callstats.reportError(this.pc_, this.conferenceId,
      supportedWebrtcFuncNames[funcName], new DOMException(filteredError),
      localSdp, remoteSdp);
  }
};

PeerConnectionClient.prototype.initCallstats_ = function(successCallback) {
  trace('Init callstats.');
  // jscs:disable requireCapitalizedConstructors
  /* jshint newcap: false */
  this.callstats = new callstats(null, io, jsSHA);
  // jscs:enable requireCapitalizedConstructors
  /* jshint newcap: true */

  var appId = this.params_.callstatsParams.appId;
  var appSecret = this.params_.callstatsParams.appSecret;
  this.userId = this.params_.roomId + (this.isInitiator_ ? '-0' : '-1');
  var statsCallback = null;
  var configParams = {
    applicationVersion: this.params_.versionInfo.gitHash
  };
  var callback = function(status, msg) {
    if (!this.callstatsInit) {
      if (status === 'httpError') {
        trace('Callstats could not be set up: ' + msg);
        return;
      }
      successCallback();
    }
    trace('Init status: ' + status + ' msg: ' + msg);
  }.bind(this);
  this.callstats.initialize(appId, appSecret, this.userId, callback,
      statsCallback, configParams);
};

// Setup the callstats api and attach it to the peerconnection.
PeerConnectionClient.prototype.setupCallstats_ = function() {
  // Check dependencies.
  if (typeof io !== 'function' && typeof jsSHA !== 'function')  {
    trace('Callstats dependencies missing, stats will not be setup.');
    return;
  }

  // Need to catch the error otherwise the peerConnection creation
  // will fail.
  try {
    // Authenticate with the callstats backend.
    var successCallback = function() {
      this.callStatsAttachedToPc = false;

      trace('Set up callstats.');
      this.conferenceId = this.params_.roomId;
      this.remoteUserId = this.params_.roomId +
          (this.isInitiator_ ? '-1' : '-0');
      // Multiplex should be used when sending audio and video on a
      // peerConnection. http://www.callstats.io/api/#enumeration-of-fabricusage
      // TODO: Might need to change this dynamically if an audio/video only
      // call.
      var usage = this.callstats.fabricUsage.multiplex;
      var callback = function(status, msg) {
        // Check if there are any commands to process.
        this.callStatsCommandQueue_.processQueue();
        trace('Callstats status: ' + status + ' msg: ' + msg);
      }.bind(this);
      // Hookup the callstats api to the peerConnection object.
      this.callstats.addNewFabric(this.pc_, this.remoteUserId, usage,
          this.conferenceId, callback);
      this.callstatsInit = true;
    }.bind(this);
    this.initCallstats_(successCallback);
  } catch (error) {
    trace('Callstats could not be set up: ' + error);
  }
};

// Associate device labels, media stream tracks to user Id in the callstats
// backend.
PeerConnectionClient.prototype.bindMstToUserIdForCallstats_ = function() {
  if (!this.isCallstatsInitialized_() || !this.pc_ &&
      !this.pc_.getLocalStreams && this.pc_.getLocalStreams().length === 0) {
    trace('Cannot associateMstWithUserID.');
    return;
  }

  // Local.
  // Local video tag changes from local-video to mini-video when the call is
  // established.
  var localVideoTagId = 'mini-video';

  // Determine local video track id, label and SSRC.
  if (this.pc_.getLocalStreams()[0].getVideoTracks().length > 0 &&
      this.pc_.localDescription) {
    var videoSendTrackId =
      this.pc_.getLocalStreams()[0].getVideoTracks()[0].id;
    var videoSendTrackLabel =
        this.pc_.getLocalStreams()[0].getVideoTracks()[0].label;
    var videoSendSsrcLine = this.pc_.localDescription.sdp.match('a=ssrc:.*.' +
        videoSendTrackId);

    // Only send if SSRC has been found.
    if (videoSendSsrcLine !== null) {
      var videoSendSsrc = videoSendSsrcLine[0].match('[0-9]+');
      this.callstats.associateMstWithUserID(this.pc_, this.userId,
          this.conferenceId, videoSendSsrc[0], videoSendTrackLabel,
          localVideoTagId);
    }
  }

  if (this.pc_.getLocalStreams()[0].getAudioTracks().length > 0 &&
      this.pc_.localDescription) {
    // Determine local audio track id, label and SSRC.
    var audioSendTrackId =
        this.pc_.getLocalStreams()[0].getAudioTracks()[0].id;
    var audioSendTrackLabel =
        this.pc_.getLocalStreams()[0].getAudioTracks()[0].label;
    var audioSendSsrcLine = this.pc_.localDescription.sdp.match('a=ssrc:.*.' +
        audioSendTrackId);

    // Only send if SSRC has been found.
    if (audioSendSsrcLine !== null) {
      var audioSendSsrc = audioSendSsrcLine[0].match('[0-9]+');
      this.callstats.associateMstWithUserID(this.pc_, this.userId,
          this.conferenceId, audioSendSsrc[0], audioSendTrackLabel,
          localVideoTagId);
    }
  }

  // Remote.
  var remoteVideoTagId = 'remote-video';

  if (this.pc_.getRemoteStreams()[0].getVideoTracks.length > 0 &&
      this.pc_.remoteDescription) {
    // Determine remote video track id, label and SSRC.
    var videoReceiveTrackId =
        this.pc_.getRemoteStreams()[0].getVideoTracks()[0].id;
    var videoReceiveTrackLabel =
        this.pc_.getRemoteStreams()[0].getVideoTracks()[0].label;
    var videoReceiveSsrcLine =
        this.pc_.remoteDescription.sdp.match('a=ssrc:.*.' +
        videoReceiveTrackId);

    // Firefox does not use SSRC.
    if (videoReceiveSsrcLine !== null) {
      var videoReceiveSsrc = videoReceiveSsrcLine[0].match('[0-9]+');
      this.callstats.associateMstWithUserID(this.pc_, this.remoteUserId,
          this.conferenceId, videoReceiveSsrc[0], videoReceiveTrackLabel,
          remoteVideoTagId);
    }
  }

  if (this.pc_.getRemoteStreams()[0].getAudioTracks.length > 0 &&
      this.pc_.remoteDescription) {
    // Determine remote audio track id, label and SSRC.
    var audioReceiveTrackId =
        this.pc_.getRemoteStreams()[0].getAudioTracks()[0].id;
    var audioReceiveTrackLabel =
        this.pc_.getRemoteStreams()[0].getAudioTracks()[0].label;
    var audioReceiveSsrcLine =
        this.pc_.remoteDescription.sdp.match('a=ssrc:.*.' +
        audioReceiveTrackId);

    // Only send if SSRC has been found.
    if (audioReceiveSsrcLine !== null) {
      var audioReceiveSsrc = audioReceiveSsrcLine[0].match('[0-9]+');
      this.callstats.associateMstWithUserID(this.pc_, this.remoteUserId,
          this.conferenceId, audioReceiveSsrc[0], audioReceiveTrackLabel,
          remoteVideoTagId);
    }
  }
};

// Send events to callstats backend.
// http://www.callstats.io/api/#enumeration-of-fabricevent
PeerConnectionClient.prototype.sendCallstatsEvents = function(fabricEvent) {
  if (!this.isCallstatsInitialized_()) {
    return;
  } else if (!fabricEvent) {
    trace('Must provide a fabricEvent.');
    return;
  }

  this.callstats.sendFabricEvent(this.pc_, fabricEvent, this.conferenceId);
};
