/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals calculateFps, computeBitrate, enumerateStats,
    iceCandidateType, computeRate */
/* exported InfoBox */

'use strict';

var InfoBox = function(infoDiv, call, versionInfo) {
  this.infoDiv_ = infoDiv;
  this.remoteVideo_ = document.getElementById('remote-video');
  this.localVideo_ = document.getElementById('mini-video');
  this.call_ = call;
  this.versionInfo_ = versionInfo;

  this.errorMessages_ = [];
  this.warningMessages_ = [];
  // Time when the call was intiated and accepted.
  this.startTime_ = null;
  this.connectTime_ = null;
  this.stats_ = null;
  this.prevStats_ = null;
  this.getStatsTimer_ = null;
  this.localTrackIds_ = {
    video: '',
    audio: ''
  };
  this.remoteTrackIds_ = {
    video: '',
    audio: ''
  };

  // Types of gathered ICE Candidates.
  this.iceCandidateTypes_ = {
    Local: {},
    Remote: {}
  };

  // Used to calculate FPS for the video element.
  this.localDecodedFrames_ = 0;
  this.localStartTime_ = 0;
  this.localVideo_.addEventListener('playing', function(event) {
    this.localDecodedFrames_ = event.target.webkitDecodedFrameCount;
    this.localStartTime_ = new Date().getTime();
  }.bind(this));

  this.remoteDecodedFrames_ = 0;
  this.remoteStartTime_ = 0;
  this.remoteVideo_.addEventListener('playing', function(event) {
    this.remoteDecodedFrames_ = event.target.webkitDecodedFrameCount;
    this.remoteStartTime_ = new Date().getTime();
  }.bind(this));
};

InfoBox.prototype.getLocalTrackIds = function(stream) {
  stream.getTracks().forEach(function(track) {
    if (track.kind === 'audio') {
      this.localTrackIds_.audio = track.id;
    } else if (track.kind === 'video') {
      this.localTrackIds_.video = track.id;
    }
  }.bind(this));
};

InfoBox.prototype.getRemoteTrackIds = function(stream) {
  stream.getTracks().forEach(function(track) {
    if (track.kind === 'audio') {
      this.remoteTrackIds_.audio = track.id;
    } else if (track.kind === 'video') {
      this.remoteTrackIds_.video = track.id;
    }
  }.bind(this));
};

InfoBox.prototype.recordIceCandidateTypes = function(location, candidate) {
  var type = iceCandidateType(candidate);

  var types = this.iceCandidateTypes_[location];
  if (!types[type]) {
    types[type] = 1;
  } else {
    ++types[type];
  }
  this.updateInfoDiv();
};

InfoBox.prototype.pushErrorMessage = function(msg) {
  this.errorMessages_.push(msg);
  this.updateInfoDiv();
  this.showInfoDiv();
};

InfoBox.prototype.pushWarningMessage = function(msg) {
  this.warningMessages_.push(msg);
  this.updateInfoDiv();
  this.showInfoDiv();
};

InfoBox.prototype.setSetupTimes = function(startTime, connectTime) {
  this.startTime_ = startTime;
  this.connectTime_ = connectTime;
};

InfoBox.prototype.showInfoDiv = function() {
  this.getStatsTimer_ = setInterval(this.refreshStats_.bind(this), 1000);
  this.refreshStats_();
  this.infoDiv_.classList.add('active');
};

InfoBox.prototype.toggleInfoDiv = function() {
  if (this.infoDiv_.classList.contains('active')) {
    clearInterval(this.getStatsTimer_);
    this.infoDiv_.classList.remove('active');
  } else {
    this.showInfoDiv();
  }
};

InfoBox.prototype.refreshStats_ = function() {
  this.call_.getPeerConnectionStats(function(response) {
    this.prevStats_ = this.stats_;
    this.stats_ = response;
    this.updateInfoDiv();
  }.bind(this));
};

InfoBox.prototype.updateInfoDiv = function() {
  var contents = '<pre id="info-box-stats" style="line-height: initial">';

  if (this.stats_) {
    var states = this.call_.getPeerConnectionStates();
    if (!states) {
      return;
    }
    // Build the display.
    contents += this.buildLine_('States');
    contents += this.buildLine_('Signaling', states.signalingState);
    contents += this.buildLine_('Gathering', states.iceGatheringState);
    contents += this.buildLine_('Connection', states.iceConnectionState);
    for (var endpoint in this.iceCandidateTypes_) {
      var types = [];
      for (var type in this.iceCandidateTypes_[endpoint]) {
        types.push(type + ':' + this.iceCandidateTypes_[endpoint][type]);
      }
      contents += this.buildLine_(endpoint, types.join(' '));
    }
    var statReport = enumerateStats(this.stats_, this.localTrackIds_,
        this.remoteTrackIds_);

    var connectionStats = statReport.connection;
    var localAddr;
    var remoteAddr;
    var localAddrType;
    var remoteAddrType;
    var localPort;
    var remotePort;
    if (connectionStats) {
      localAddr = connectionStats.localIp;
      remoteAddr = connectionStats.remoteIp;
      localAddrType = connectionStats.localType;
      remoteAddrType = connectionStats.remoteType;
      localPort = connectionStats.localPort;
      remotePort = connectionStats.remotePort;
    }
    if (localAddr && remoteAddr) {
      var relayProtocol = connectionStats.localRelayProtocol;
      contents += this.buildLine_('LocalAddr', localAddr +
          ' (' + localAddrType + (typeof relayProtocol !== undefined ? '' +
          'TURN/' + relayProtocol.toUpperCase() : '') + ')');
      contents += this.buildLine_('LocalPort', localPort);
      contents += this.buildLine_('RemoteAddr', remoteAddr + ' (' +
          remoteAddrType + ')');
      contents += this.buildLine_('RemotePort', remotePort);
    }
    contents += this.buildLine_();

    contents += this.buildStatsSection_();
  }

  if (this.errorMessages_.length > 0 || this.warningMessages_.length > 0) {
    contents += this.buildLine_('\nMessages');
    if (this.errorMessages_.length) {
      this.infoDiv_.classList.add('warning');
      for (var i = 0; i !== this.errorMessages_.length; ++i) {
        contents += this.errorMessages_[i] + '\n';
      }
    } else {
      this.infoDiv_.classList.add('active');
      for (var j = 0; j !== this.warningMessages_.length; ++j) {
        contents += this.warningMessages_[j] + '\n';
      }
    }
  } else {
    this.infoDiv_.classList.remove('warning');
  }

  if (this.versionInfo_) {
    contents += this.buildLine_();
    contents += this.buildLine_('Version');
    for (var key in this.versionInfo_) {
      contents += this.buildLine_(key, this.versionInfo_[key]);
    }
  }

  contents += '</pre>';

  if (this.infoDiv_.innerHTML !== contents) {
    this.infoDiv_.innerHTML = contents;
  }
};

InfoBox.prototype.buildStatsSection_ = function() {
  var contents = this.buildLine_('Stats');
  var statReport = enumerateStats(this.stats_, this.localTrackIds_,
      this.remoteTrackIds_);
  var prevStatReport = enumerateStats(this.prevStats_, this.localTrackIds_,
      this.remoteTrackIds_);

  // Obtain setup and latency this.stats_.
  var totalRtt = statReport.connection.totalRoundTripTime * 1000;
  var currentRtt = statReport.connection.currentRoundTripTime * 1000;

  if (this.endTime_ !== null) {
    contents += this.buildLine_('Call time',
        InfoBox.formatInterval_(window.performance.now() - this.connectTime_));
    contents += this.buildLine_('Setup time',
        InfoBox.formatMsec_(this.connectTime_ - this.startTime_));
  }
  if (statReport.connection.remoteIp !== '' ) {
    contents += this.buildLine_('TotalRtt', InfoBox.formatMsec_(totalRtt));
    contents += this.buildLine_('CurrentRtt', InfoBox.formatMsec_(currentRtt));
  }

  var rxAudio = statReport.audio.remote;
  var rxPrevAudio = prevStatReport.audio.remote;
  var rxPrevVideo = prevStatReport.video.remote;
  var rxVideo = statReport.video.remote;
  var txAudio = statReport.audio.local;
  var txPrevAudio = prevStatReport.audio.local;
  var txPrevVideo = prevStatReport.video.local;
  var txVideo = statReport.video.local;

  var rxAudioBitrate;
  var rxAudioClockRate;
  var rxAudioCodec;
  var rxAudioJitter;
  var rxAudioLevel;
  var rxAudioPacketRate;
  var rxAudioPlType;
  var rxVideoBitrate;
  var rxVideoCodec;
  var rxVideoDroppedFrames;
  var rxVideoFirCount;
  var rxVideoFps;
  var rxVideoHeight;
  var rxVideoNackCount;
  var rxVideoPacketRate;
  var rxVideoPliCount;
  var rxVideoPlType;

  var txAudioBitrate;
  var txAudioClockRate;
  var txAudioCodec;
  var txAudioLevel;
  var txAudioPacketRate;
  var txAudioPlType;
  var txVideoBitrate;
  var txVideoCodec;
  var txVideoFirCount;
  var txVideoFps;
  var txVideoHeight;
  var txVideoNackCount;
  var txVideoPacketRate;
  var txVideoPliCount;
  var txVideoPlType;

  if (txAudio.codecId !== '' && txAudio.payloadType !== 0) {
    txAudioCodec = txAudio.mimeType;
    txAudioLevel = parseFloat(txAudio.audioLevel).toFixed(3);
    txAudioClockRate = txAudio.clockRate;
    txAudioPlType = txAudio.payloadType;
    txAudioBitrate = computeBitrate(txAudio, txPrevAudio, 'bytesSent');
    txAudioPacketRate = computeRate(txAudio, txPrevAudio, 'packetsSent');
    contents += this.buildLine_(
        'Audio Tx', txAudioCodec + '/' + txAudioPlType + ', ' +
        'rate ' + txAudioClockRate + ', ' +
        InfoBox.formatBitrate_(txAudioBitrate) + ', ' +
        InfoBox.formatPacketRate_(txAudioPacketRate) + ', inputLevel ' +
        txAudioLevel);
  }
  if (rxAudio.codecId !== '' && rxAudio.payloadType !== 0) {
    rxAudioCodec = rxAudio.mimeType;
    rxAudioLevel = parseFloat(rxAudio.audioLevel).toFixed(3);
    rxAudioJitter = parseFloat(rxAudio.jitter).toFixed(3);
    rxAudioClockRate = rxAudio.clockRate;
    rxAudioPlType = rxAudio.payloadType;
    rxAudioBitrate = computeBitrate(rxAudio, rxPrevAudio, 'bytesReceived');
    rxAudioPacketRate = computeRate(rxAudio, rxPrevAudio, 'packetsReceived');
    contents += this.buildLine_(
        'Audio Rx', rxAudioCodec + '/' + rxAudioPlType + ', ' +
        'rate ' + rxAudioClockRate + ', ' +
        'jitter ' + rxAudioJitter + ', ' +
        InfoBox.formatBitrate_(rxAudioBitrate) + ', ' +
        InfoBox.formatPacketRate_(rxAudioPacketRate) + ', outputLevel ' +
        rxAudioLevel);
  }
  if (txVideo.codecId !== '' && txVideo.payloadType !== 0 &&
      txVideo.frameHeight !== 0) {
    txVideoCodec = txVideo.mimeType;
    txVideoHeight = txVideo.frameHeight;
    txVideoPlType = txVideo.payloadType;
    txVideoPliCount = txVideo.pliCount;
    txVideoFirCount = txVideo.firCount;
    txVideoNackCount = txVideo.nackCount;
    txVideoFps = calculateFps(this.remoteVideo_, this.remoteDecodedFrames_,
        this.remoteStartTime_, 'local', this.updateDecodedFramesCallback_);
    txVideoBitrate = computeBitrate(txVideo, txPrevVideo, 'bytesSent');
    txVideoPacketRate = computeRate(txVideo, txPrevVideo, 'packetsSent');
    contents += this.buildLine_('Video Tx',
        txVideoCodec + '/' + txVideoPlType + ', ' + txVideoHeight.toString() +
        'p' + txVideoFps.toString() + ', ' +
        'firCount ' + txVideoFirCount + ', ' +
        'pliCount ' + txVideoPliCount + ', ' +
        'nackCount ' + txVideoNackCount + ', ' +
        InfoBox.formatBitrate_(txVideoBitrate) + ', ' +
        InfoBox.formatPacketRate_(txVideoPacketRate));
  }
  if (rxVideo.codecId !== '' && rxVideo.payloadType !== 0 &&
      txVideo.frameHeight !== 0) {
    rxVideoCodec = rxVideo.mimeType;
    rxVideoHeight = rxVideo.frameHeight;
    rxVideoPlType = rxVideo.payloadType;
    rxVideoDroppedFrames = rxVideo.framesDropped;
    rxVideoPliCount = rxVideo.pliCount;
    rxVideoFirCount = rxVideo.firCount;
    rxVideoNackCount = rxVideo.nackCount;
    rxVideoFps = calculateFps(this.remoteVideo_, this.remoteDecodedFrames_,
        this.remoteStartTime_, 'remote', this.updateDecodedFramesCallback_);
    rxVideoBitrate = computeBitrate(rxVideo, rxPrevVideo, 'bytesReceived');
    rxVideoPacketRate = computeRate(rxVideo, rxPrevVideo, 'packetsReceived');
    contents += this.buildLine_('Video Rx',
        rxVideoCodec + '/' + rxVideoPlType + ', ' + rxVideoHeight.toString() +
        'p' + rxVideoFps.toString() + ', ' +
        'firCount ' + rxVideoFirCount + ', ' +
        'pliCount ' + rxVideoPliCount + ', ' +
        'nackCount ' + rxVideoNackCount + ', ' +
        'droppedFrames ' + rxVideoDroppedFrames + ', ' +
        InfoBox.formatBitrate_(rxVideoBitrate) + ', ' +
        InfoBox.formatPacketRate_(rxVideoPacketRate));
  }
  return contents;
};

// Callback that sets used to keep track for calculating FPS for video elements.
InfoBox.prototype.updateDecodedFramesCallback_ = function(
  decodedFrames_, startTime_, remoteOrLocal) {
  if (remoteOrLocal === 'local') {
    this.localDecodedFrames_ = decodedFrames_;
    this.localStartTime_ = startTime_;
  } else if (remoteOrLocal === 'remote') {
    this.remoteDecodedFrames_ = decodedFrames_;
    this.remoteStartTime_ = startTime_;
  }
};

InfoBox.prototype.buildLine_ = function(label, value) {
  var columnWidth = 12;
  var line = '';
  if (label) {
    line += label + ':';
    while (line.length < columnWidth) {
      line += ' ';
    }

    if (value) {
      line += value;
    }
  }
  line += '\n';
  return line;
};

// Convert a number of milliseconds into a '[HH:]MM:SS' string.
InfoBox.formatInterval_ = function(value) {
  var result = '';
  var seconds = Math.floor(value / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  var formatTwoDigit = function(twodigit) {
    return ((twodigit < 10) ? '0' : '') + twodigit.toString();
  };

  if (hours > 0) {
    result += formatTwoDigit(hours) + ':';
  }
  result += formatTwoDigit(minutes - hours * 60) + ':';
  result += formatTwoDigit(seconds - minutes * 60);
  return result;
};

// Convert a number of milliesconds into a 'XXX ms' string.
InfoBox.formatMsec_ = function(value) {
  return value.toFixed(0).toString() + ' ms';
};

// Convert a bitrate into a 'XXX Xbps' string.
InfoBox.formatBitrate_ = function(value) {
  if (!value) {
    return '- bps';
  }

  var suffix;
  if (value < 1000) {
    suffix = 'bps';
  } else if (value < 1000000) {
    suffix = 'kbps';
    value /= 1000;
  } else {
    suffix = 'Mbps';
    value /= 1000000;
  }

  var str = value.toPrecision(3) + ' ' + suffix;
  return str;
};

// Convert a packet rate into a 'XXX pps' string.
InfoBox.formatPacketRate_ = function(value) {
  if (!value) {
    return '- pps';
  }
  return value.toPrecision(3) + ' ' + 'pps';
};
