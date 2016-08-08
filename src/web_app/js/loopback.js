/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* exported setupLoopback */

'use strict';

function setupLoopback(params) {
  trace('Setting up loopback peerConnection client.');
  // Reuse the parameters from peerConnection 1 by creating a new object and
  // modify it to what's needed for peerConnection 2.
  var params_ = JSON.parse(JSON.stringify(params));
  params_.clientId = 'LOOPBACK_CLIENT_ID_2';
  params_.isInitiator = false;
  params_.mediaConstraints.audio = false;
  params_.mediaConstraints.video = false;
  // For loopback calls we reuse the parameters from peerConnection 1 hence it
  // does not need to request ICE servers and also we do not need gUM since the
  // remote stream is cloned and used as a local stream for peerConnection 2.
  var call = new Call(params_, true);

  // Dereference the call object so the peerConnection can be garbage collected.
  function deleteCall() {
    call = null;
  }

  // Hangup peerconnection 2 properly since the UI only controls
  // peerconnection 1.
  call.onremotehangup = function() {
    this.hangup(true);
    this.startTime = null;
    if (this.pcClient_) {
      this.pcClient_.close();
      this.pcClient_ = null;
    }
    deleteCall();
  }.bind(call);

  // Add the remote stream from peerConnection 1 as a local stream for
  // peerConnection 2 (loopback) before sending an answer to avoid renegotiation
  // since peerConnection 2 does not have a access to the stream until
  // peerConnection 1 has added it.
  call.onremotestreamadded = function(event) {
    if (this.params_.clientId === 'LOOPBACK_CLIENT_ID_2') {
      // Since this fired once per track we need to make sure it will only add
      // the stream once.
      if (this.pcClient_.loopBackStream === null) {
        // 2nd peerConnection should not be the initiator.
        if (!this.params_.isInitiator_) {
          this.pcClient_.loopBackStream = event.clone();
          // Disable tracks on the remote tracks of the remote stream otherwise
          // it will be played back by the Chrome mixer as well.
          event.getAudioTracks()[0].enabled = false;
          this.pcClient_.pc_.addStream(this.pcClient_.loopBackStream);
          this.pcClient_.doAnswer_();
        }
      }
    }
  }.bind(call);

  // Make sure to shutdown peerConnection 2 properly when a user
  // closes the tab.
  window.onbeforeunload = function() {
    call.hangup.bind(call, false);
  };

  // Start peerConnection 2.
  call.start(params_.roomId);
}
