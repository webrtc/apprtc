/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals trace, InfoBox, setUpFullScreen, isFullScreen, LibWebP,
   RoomSelection, isChromeApp, $ */
/* exported AppController, remoteVideo */

'use strict';

// TODO(jiayl): remove |remoteVideo| once the chrome browser tests are updated.
// Do not use in the production code.
var remoteVideo = $('#remote-video');

// Keep this in sync with the HTML element id attributes. Keep it sorted.
var UI_CONSTANTS = {
  confirmJoinButton: '#confirm-join-button',
  confirmJoinDiv: '#confirm-join-div',
  confirmJoinRoomSpan: '#confirm-join-room-span',
  fullscreenSvg: '#fullscreen',
  hangupSvg: '#hangup',
  icons: '#icons',
  infoDiv: '#info-div',
  localVideo: '#local-video',
  miniCanvas: '#mini-canvas',
  miniVideo: '#mini-video',
  muteAudioSvg: '#mute-audio',
  muteVideoSvg: '#mute-video',
  newRoomButton: '#new-room-button',
  newRoomLink: '#new-room-link',
  privacyLinks: '#privacy',
  remoteCanvas: '#remote-canvas',
  remoteVideo: '#remote-video',
  rejoinButton: '#rejoin-button',
  rejoinDiv: '#rejoin-div',
  rejoinLink: '#rejoin-link',
  roomLinkHref: '#room-link-href',
  roomSelectionDiv: '#room-selection',
  roomSelectionInput: '#room-id-input',
  roomSelectionInputLabel: '#room-id-input-label',
  roomSelectionJoinButton: '#join-button',
  roomSelectionRandomButton: '#random-button',
  roomSelectionRecentList: '#recent-rooms-list',
  sharingDiv: '#sharing-div',
  statusDiv: '#status-div',
  videosDiv: '#videos',
};

// The controller that connects the Call with the UI.
var AppController = function (loadingParams) {
  trace('Initializing; server= ' + loadingParams.roomServer + '.');
  trace('Initializing; room=' + loadingParams.roomId + '.');

  this.hangupSvg_ = $(UI_CONSTANTS.hangupSvg);
  this.icons_ = $(UI_CONSTANTS.icons);
  this.localVideo_ = $(UI_CONSTANTS.localVideo);
  this.miniCanvas_ = $(UI_CONSTANTS.miniCanvas);
  this.miniVideo_ = $(UI_CONSTANTS.miniVideo);
  this.sharingDiv_ = $(UI_CONSTANTS.sharingDiv);
  this.statusDiv_ = $(UI_CONSTANTS.statusDiv);
  this.remoteCanvas_ = $(UI_CONSTANTS.remoteCanvas);
  this.remoteVideo_ = $(UI_CONSTANTS.remoteVideo);
  this.videosDiv_ = $(UI_CONSTANTS.videosDiv);
  this.roomLinkHref_ = $(UI_CONSTANTS.roomLinkHref);
  this.rejoinDiv_ = $(UI_CONSTANTS.rejoinDiv);
  this.rejoinLink_ = $(UI_CONSTANTS.rejoinLink);
  this.newRoomLink_ = $(UI_CONSTANTS.newRoomLink);
  this.rejoinButton_ = $(UI_CONSTANTS.rejoinButton);
  this.newRoomButton_ = $(UI_CONSTANTS.newRoomButton);

  this.deactivate_(this.miniCanvas_);
  this.deactivate_(this.remoteCanvas_);

  this.newRoomButton_.addEventListener('click',
    this.onNewRoomClick_.bind(this), false);
  this.rejoinButton_.addEventListener('click',
    this.onRejoinClick_.bind(this), false);

  this.muteAudioIconSet_ =
    new AppController.IconSet_(UI_CONSTANTS.muteAudioSvg);
  this.muteVideoIconSet_ =
    new AppController.IconSet_(UI_CONSTANTS.muteVideoSvg);
  this.fullscreenIconSet_ =
    new AppController.IconSet_(UI_CONSTANTS.fullscreenSvg);

  this.loadingParams_ = loadingParams;
  this.loadUrlParams_();

  if (this.loadingParams_.libvpx) {
    const src = '/wasm/libvpx/vpx-worker.js';

    this.vpxenc_ = new Worker(src);
    this.vpxdec_ = new Worker(src);

    console.log([
      'Default VPX params:',
      '',
      '   ?codec=vp8    Can also use vp9.',
      '   ?width=640',
      '   ?height=480',
      '   ?vsbr=1500    Video bitrate in kilobits per second.',
      '   ?fps=30       fps=0 would allow to send frames one by one.',
      '   ?packet=16    The packet size in KB. Cannot exceed 64 KB.',
      '',
      'For example, to encode 720p video with VP9 use:',
      '',
      '   ?libvpx=1&codec=vp9&width=1280&height=720',
    ].join('\n'));

    this.vpxconfig_ = {};

    this.vpxconfig_.packetSize = +(this.loadingParams_.packet || 64) << 10;
    this.vpxconfig_.codec = (this.loadingParams_.videoCodec || 'vp8').toUpperCase();
    this.vpxconfig_.width = +(this.loadingParams_.videoWidth || 640);
    this.vpxconfig_.height = +(this.loadingParams_.videoHeight || 480);
    this.vpxconfig_.fps = +(this.loadingParams_.videoFps || 30);
    this.vpxconfig_.bitrate = +(this.loadingParams_.videoSendBitrate || 1500);

    console.log('VPX config:', this.vpxconfig_);

    this.vpxenc_.postMessage({ type: 'init', data: this.vpxconfig_ });
    this.vpxdec_.postMessage({ type: 'init', data: this.vpxconfig_ });
  } else if (this.loadingParams_.webrtc) {
    console.log([
      'Loading WebRTC. Default WebRTC params will just use audio in wasm.',
      'To use WebRTC (in wasm) for audio & video:',
      '',
      '   ?webrtc=1&webrtcvideo=1',
    ].join('\n'));
    this.webrtc_ = new WebRTC(this.loadingParams_.webrtcVideo, this.miniVideo_);
  } else {
    this.libwebp_ = new LibWebP();
  }

  var paramsPromise = Promise.resolve({});
  if (this.loadingParams_.paramsFunction) {
    // If we have a paramsFunction value, we need to call it
    // and use the returned values to merge with the passed
    // in params. In the Chrome app, this is used to initialize
    // the app with params from the server.
    paramsPromise = this.loadingParams_.paramsFunction();
  }

  Promise.resolve(paramsPromise).then(function (newParams) {
    // Merge newly retrieved params with loadingParams.
    if (newParams) {
      Object.keys(newParams).forEach(function (key) {
        this.loadingParams_[key] = newParams[key];
      }.bind(this));
    }

    console.log('Config:', this.loadingParams_);

    this.roomLink_ = '';
    this.roomSelection_ = null;
    this.localStream_ = null;
    this.remoteVideoResetTimer_ = null;

    // If the params has a roomId specified, we should connect to that room
    // immediately. If not, show the room selection UI.
    if (this.loadingParams_.roomId) {
      this.createCall_();

      // Ask the user to confirm.
      if (!RoomSelection.matchRandomRoomPattern(this.loadingParams_.roomId)) {
        // Show the room name only if it does not match the random room pattern.
        $(UI_CONSTANTS.confirmJoinRoomSpan).textContent = ' "' +
          this.loadingParams_.roomId + '"';
      }
      var confirmJoinDiv = $(UI_CONSTANTS.confirmJoinDiv);
      this.show_(confirmJoinDiv);

      $(UI_CONSTANTS.confirmJoinButton).onclick = function () {
        this.hide_(confirmJoinDiv);

        // Record this room in the recently used list.
        var recentlyUsedList = new RoomSelection.RecentlyUsedList();
        recentlyUsedList.pushRecentRoom(this.loadingParams_.roomId);
        this.finishCallSetup_(this.loadingParams_.roomId);
      }.bind(this);

      if (this.loadingParams_.bypassJoinConfirmation) {
        $(UI_CONSTANTS.confirmJoinButton).onclick();
      }
    } else {
      // Display the room selection UI.
      this.showRoomSelection_();
    }
  }.bind(this)).catch(function (error) {
    trace('Error initializing: ' + error.message);
  }.bind(this));
};

AppController.prototype.createCall_ = function () {
  var privacyLinks = $(UI_CONSTANTS.privacyLinks);
  this.hide_(privacyLinks);
  this.call_ = new Call(this.loadingParams_);
  this.infoBox_ = new InfoBox($(UI_CONSTANTS.infoDiv), this.call_,
    this.loadingParams_.versionInfo);

  var roomErrors = this.loadingParams_.errorMessages;
  var roomWarnings = this.loadingParams_.warningMessages;
  if (roomErrors && roomErrors.length > 0) {
    for (var i = 0; i < roomErrors.length; ++i) {
      this.infoBox_.pushErrorMessage(roomErrors[i]);
    }
    return;
  } else if (roomWarnings && roomWarnings.length > 0) {
    for (var j = 0; j < roomWarnings.length; ++j) {
      this.infoBox_.pushWarningMessage(roomWarnings[j]);
    }
  }

  // TODO(jiayl): replace callbacks with events.
  this.call_.onremotehangup = this.onRemoteHangup_.bind(this);
  this.call_.onremotesdpset = this.onRemoteSdpSet_.bind(this);
  this.call_.onremotestreamadded = this.onRemoteStreamAdded_.bind(this);
  this.call_.onlocalstreamadded = this.onLocalStreamAdded_.bind(this);

  this.call_.onsignalingstatechange =
    this.infoBox_.updateInfoDiv.bind(this.infoBox_);
  this.call_.oniceconnectionstatechange =
    this.infoBox_.updateInfoDiv.bind(this.infoBox_);
  this.call_.onnewicecandidate =
    this.infoBox_.recordIceCandidateTypes.bind(this.infoBox_);

  this.call_.onerror = this.displayError_.bind(this);
  this.call_.onstatusmessage = this.displayStatus_.bind(this);
  this.call_.oncallerstarted = this.displaySharingInfo_.bind(this);
};

AppController.prototype.showRoomSelection_ = function () {
  var roomSelectionDiv = $(UI_CONSTANTS.roomSelectionDiv);
  this.roomSelection_ = new RoomSelection(roomSelectionDiv, UI_CONSTANTS);

  this.show_(roomSelectionDiv);
  this.roomSelection_.onRoomSelected = function (roomName) {
    this.hide_(roomSelectionDiv);
    this.createCall_();
    this.finishCallSetup_(roomName);

    this.roomSelection_.removeEventListeners();
    this.roomSelection_ = null;
    if (this.localStream_) {
      this.attachLocalStream_();
    }
  }.bind(this);
};

AppController.prototype.setupUi_ = function () {
  this.iconEventSetup_();
  document.onkeypress = this.onKeyPress_.bind(this);
  window.onmousemove = this.showIcons_.bind(this);

  $(UI_CONSTANTS.muteAudioSvg).onclick = this.toggleAudioMute_.bind(this);
  $(UI_CONSTANTS.muteVideoSvg).onclick = this.toggleVideoMute_.bind(this);
  $(UI_CONSTANTS.fullscreenSvg).onclick = this.toggleFullScreen_.bind(this);
  $(UI_CONSTANTS.hangupSvg).onclick = this.hangup_.bind(this);

  setUpFullScreen();
};

AppController.prototype.finishCallSetup_ = function (roomId) {
  this.call_.start(roomId);
  this.setupUi_();

  if (!isChromeApp()) {
    // Call hangup with async = false. Required to complete multiple
    // clean up steps before page is closed.
    // Chrome apps can't use onbeforeunload.
    window.onbeforeunload = function () {
      this.call_.hangup(false);
    }.bind(this);

    window.onpopstate = function (event) {
      if (!event.state) {
        // TODO (chuckhays) : Resetting back to room selection page not
        // yet supported, reload the initial page instead.
        trace('Reloading main page.');
        location.href = location.origin;
      } else {
        // This could be a forward request to open a room again.
        if (event.state.roomLink) {
          location.href = event.state.roomLink;
        }
      }
    };
  }
};

AppController.prototype.hangup_ = function () {
  trace('Hanging up.');
  this.hide_(this.icons_);
  this.displayStatus_('Hanging up');
  this.transitionToDone_();

  // Call hangup with async = true.
  this.call_.hangup(true);
  // Reset key and mouse event handlers.
  document.onkeypress = null;
  window.onmousemove = null;
};

AppController.prototype.onRemoteHangup_ = function () {
  this.displayStatus_('The remote side hung up.');
  this.transitionToWaiting_();

  this.call_.onRemoteHangup();
};

AppController.prototype.onRemoteSdpSet_ = function (hasRemoteVideo) {
  if(window.dc === undefined) {
    window.pc.addEventListener("datachannel", event => { this.transitionToActive_(); });
  } else {
    // TODO(juberti): Make this wait for ICE connection before transitioning.
    // TODO(psla): Make this wait for Data Channel when wartc is used.
    this.transitionToActive_();
  }
};

AppController.prototype.waitForRemoteVideo_ = function () {
  // Wait for the actual video to start arriving before moving to the active
  // call state.
  if (this.remoteVideo_.readyState >= 2) { // i.e. can play
    trace('Remote video started; currentTime: ' +
      this.remoteVideo_.currentTime);
    this.transitionToActive_();
  } else {
    this.remoteVideo_.oncanplay = this.waitForRemoteVideo_.bind(this);
  }
};

AppController.prototype.onRemoteStreamAdded_ = function (stream) {
  this.deactivate_(this.sharingDiv_);
  trace('Remote stream added.');
  this.remoteVideo_.srcObject = stream;
  this.infoBox_.getRemoteTrackIds(stream);


  if (this.remoteVideoResetTimer_) {
    clearTimeout(this.remoteVideoResetTimer_);
    this.remoteVideoResetTimer_ = null;
  }
};

AppController.prototype.onLocalStreamAdded_ = function (stream) {
  trace('User has granted access to local media.');
  this.localStream_ = stream;
  this.infoBox_.getLocalTrackIds(this.localStream_);

  if (!this.roomSelection_) {
    this.attachLocalStream_();
  }
};

AppController.prototype.attachLocalStream_ = function () {
  trace('Attaching local stream.');
  this.localVideo_.srcObject = this.localStream_;

  this.displayStatus_('');
  this.activate_(this.localVideo_);
  this.show_(this.icons_);
  if (this.localStream_.getVideoTracks().length === 0) {
    this.hide_($(UI_CONSTANTS.muteVideoSvg));
  }
  if (this.localStream_.getAudioTracks().length === 0) {
    this.hide_($(UI_CONSTANTS.muteAudioSvg));
  }
};

AppController.prototype.transitionToActive_ = function () {
  // Stop waiting for remote video.
  this.remoteVideo_.oncanplay = undefined;
  var connectTime = window.performance.now();
  this.infoBox_.setSetupTimes(this.call_.startTime, connectTime);
  this.infoBox_.updateInfoDiv();
  trace('Call setup time: ' + (connectTime - this.call_.startTime).toFixed(0) +
    'ms.');

  // Prepare the remote video and PIP elements.
  trace('reattachMediaStream: ' + this.localVideo_.srcObject);
  this.miniVideo_.srcObject = this.localVideo_.srcObject;

  // Transition opacity from 0 to 1 for the remote and mini videos.
  this.activate_(this.remoteVideo_);
  this.activate_(this.miniVideo_);
  // Transition opacity from 1 to 0 for the local video.
  this.deactivate_(this.localVideo_);
  this.localVideo_.srcObject = null;
  // Rotate the div containing the videos 180 deg with a CSS transform.
  this.activate_(this.videosDiv_);
  this.show_(this.hangupSvg_);
  this.displayStatus_('');

  // this.deactivate_(this.miniVideo_);
  this.deactivate_(this.remoteVideo_);
  // this.activate_(this.miniCanvas_);
  this.activate_(this.remoteCanvas_);

  if (!this.listenersAdded_) {
    this.listenersAdded_ = true;

    if (this.libwebp_) {
      this.installWebP_();
    } else if (this.vpxconfig_) {
      this.installVPX_();
    }
  }
};

AppController.prototype.installWebP_ = function () {
  const {width, height} = this.miniCanvas_;

  const miniCtx2d = this.miniCanvas_.getContext('2d');
  const remoteCtx2d = this.remoteCanvas_.getContext('2d');

  setInterval(() => {
    miniCtx2d.drawImage(this.miniVideo_, 0, 0, width, height);
    const frame = miniCtx2d.getImageData(0, 0, width, height);
    console.warn('video frame', frame);
    const encoded = this.libwebp_.encode(frame);
    console.warn('encoded', encoded.length);
    dc.send(encoded); // 64 KB max
  }, 1500);

  dc.onmessage = event => {
    const encoded = new Uint8Array(event.data);
    console.warn('encoded remote frame:', encoded);
    const {data, width, height} = this.libwebp_.decode(encoded);
    console.warn('decoded remote frame:', width, height, data);
    const frame = remoteCtx2d.createImageData(width, height);
    frame.data.set(data, 0);
    remoteCtx2d.putImageData(frame, 0, 0);
  };
};

AppController.prototype.installVPX_ = function () {
  const {width, height, fps, packetSize} = this.vpxconfig_;

  this.remoteCanvas_.width = width;
  this.remoteCanvas_.height = height;

  const remoteContext2d = this.remoteCanvas_.getContext('2d');
  const remoteRgbaData = remoteContext2d.getImageData(0, 0, width, height);

  const localCanvas = document.createElement('canvas');
  localCanvas.width = width;
  localCanvas.height = height;
  const localContext2d = localCanvas.getContext('2d');

  let enctime, dectime, encoding = false, nframes = 0, latestFrame = null;
  let decbuf = new Uint8Array(1 << 20), decbuflen = 0;

  setInterval(() => {
    uistats.sendFps.set(nframes);
    nframes = 0;
  }, 1000);

  // Lifetime of an outgoing video frame:
  //  - Every 1000/fps ms canvas.drawImage grabs a RGBA frame
  //  - postMessage transfers the data to the VPX encoder web worker
  //  - sendEncodedFrame sends the delta-frame created by the encoder
  // The encoder thread doesn't have a bakclog of the frames to be encoded:
  // the UI thread ensures that the encoder is called only when it's idle.
  const grabLocalFrame = () => {
    localContext2d.drawImage(this.miniVideo_, 0, 0, width, height);
    const {data: rgba} = localContext2d.getImageData(0, 0, width, height);
    latestFrame = rgba;
    encodeLatestFrame();
  };

  const encodeLatestFrame = () => {
    if (encoding) return;
    encoding = true;
    enctime = Date.now();
    const rgba = latestFrame;
    latestFrame = null;

    this.vpxenc_.postMessage({
      id: 'enc',
      type: 'call',
      name: 'encode',
      args: [rgba.buffer]
    }, [rgba.buffer]);
  };

  const sendEncodedFrame = packets => {
    uistats.encFrame.set(Date.now() - enctime);
    uistats.sentSize.set(packets.length);
    nframes++;

    if (window.dc && dc.readyState == 'open') {
      for (let offset = 0; offset < packets.length; offset += packetSize) {
        let length = Math.min(packetSize, packets.length - offset);
        let view = new Uint8Array(packets.buffer, offset, length);
        dc.send(view); // 64 KB max
      }
    }
  };

  const drawDecodedFrame = rgba => {
    remoteRgbaData.data.set(rgba);
    remoteContext2d.putImageData(remoteRgbaData, 0, 0);
    uistats.decFrame.set(Date.now() - dectime);
  };

  const recvVpxResponse = rsp => {
    // console.log('Received response from VPX:', rsp);
    let {id, res, err} = rsp;
    if (err) return;

    // This doesn't copy data, but creates a view into an existing ArrayBuffer
    // transferred by postMessage from the web worker.
    res = new Uint8Array(res);

    switch (id) {
    case 'enc':
      sendEncodedFrame(res);
      encoding = false;
      latestFrame && encodeLatestFrame();
      break;
    case 'dec':
      drawDecodedFrame(res);
      break;
    default:
      console.warn('Unhandled response.');
    }
  };

  // Lifetime of an incoming video frame:
  //  - The data channel delivers the delta frame data.
  //  - postMessage transfers the data to the VPX decoder web worker.
  //  - drawDecodedFrame draws the decoded RGBA frame on the canvas.
  // Delta frame aren't skipped as otherwise the video would become blurry. This
  // means that the decoder thread may have a backlog of pending delta frames.
  // The backlog is transparently maintained for us by the postMessage function.
  // However since the decoder is fast, it almost never has a backlog.
  const recvIncomingDeltaFrame = data => {
    data = new Uint8Array(data);
    decbuf.set(data, decbuflen);
    decbuflen += data.length;
    if (data.length == packetSize)
      return; // wait for the final chunk of the incoming frame

    dectime = Date.now();
    const packets = decbuf.slice(0, decbuflen);
    uistats.recvSize.set(packets.length);
    decbuflen = 0;

    this.vpxdec_.postMessage({
      id: 'dec',
      type: 'call',
      name: 'decode',
      args: [packets.buffer],
    }, [packets.buffer]);
  };

  if (fps > 0) {
    // Every 1000/fps ms canvas.drawImage will be capturing a frame and sending
    // it to the VPX encoder. Each drawImage call needs 25 ms, but it runs
    // independently from the encoder. If the encoder is still busy with the
    // previous frame, the captured frame is dropped.
    setInterval(grabLocalFrame, 1000 / fps);
  } else {
    const button = document.createElement('button');
    button.setAttribute('style', 'position:fixed;left:10px;top:10px');
    button.textContent = 'Send Frame';
    document.body.append(button);
    button.addEventListener('click', () => grabLocalFrame());
  }

  // The encoder and decoder run on separate threads.
  this.vpxenc_.onmessage = event => recvVpxResponse(event.data);
  this.vpxdec_.onmessage = event => recvVpxResponse(event.data);

  // The incoming video frames come via this data channel.
  dc.onmessage = event => recvIncomingDeltaFrame(event.data);
};

AppController.prototype.transitionToWaiting_ = function () {
  // Stop waiting for remote video.
  this.remoteVideo_.oncanplay = undefined;

  this.hide_(this.hangupSvg_);
  // Rotate the div containing the videos -180 deg with a CSS transform.
  this.deactivate_(this.videosDiv_);

  if (!this.remoteVideoResetTimer_) {
    this.remoteVideoResetTimer_ = setTimeout(function () {
      this.remoteVideoResetTimer_ = null;
      trace('Resetting remoteVideo src after transitioning to waiting.');
      this.remoteVideo_.srcObject = null;
    }.bind(this), 800);
  }

  // Set localVideo.srcObject now so that the local stream won't be lost if the
  // call is restarted before the timeout.
  this.localVideo_.srcObject = this.miniVideo_.srcObject;

  // Transition opacity from 0 to 1 for the local video.
  this.activate_(this.localVideo_);
  // Transition opacity from 1 to 0 for the remote and mini videos.
  this.deactivate_(this.remoteVideo_);
  this.deactivate_(this.miniVideo_);
};

AppController.prototype.transitionToDone_ = function () {
  // Stop waiting for remote video.
  this.remoteVideo_.oncanplay = undefined;
  this.deactivate_(this.localVideo_);
  this.deactivate_(this.remoteVideo_);
  this.deactivate_(this.miniVideo_);
  this.hide_(this.hangupSvg_);
  this.activate_(this.rejoinDiv_);
  this.show_(this.rejoinDiv_);
  this.displayStatus_('');
};

AppController.prototype.onRejoinClick_ = function () {
  this.deactivate_(this.rejoinDiv_);
  this.hide_(this.rejoinDiv_);
  this.call_.restart();
  this.setupUi_();
};

AppController.prototype.onNewRoomClick_ = function () {
  this.deactivate_(this.rejoinDiv_);
  this.hide_(this.rejoinDiv_);
  this.showRoomSelection_();
};

// Spacebar, or m: toggle audio mute.
// c: toggle camera(video) mute.
// f: toggle fullscreen.
// i: toggle info panel.
// q: quit (hangup)
// Return false to screen out original Chrome shortcuts.
AppController.prototype.onKeyPress_ = function (event) {
  switch (String.fromCharCode(event.charCode)) {
    case ' ':
    case 'm':
      if (this.call_) {
        this.call_.toggleAudioMute();
        this.muteAudioIconSet_.toggle();
      }
      return false;
    case 'c':
      if (this.call_) {
        this.call_.toggleVideoMute();
        this.muteVideoIconSet_.toggle();
      }
      return false;
    case 'f':
      this.toggleFullScreen_();
      return false;
    case 'i':
      this.infoBox_.toggleInfoDiv();
      return false;
    case 'q':
      this.hangup_();
      return false;
    case 'l':
      this.toggleMiniVideo_();
      return false;
    default:
      return;
  }
};

AppController.prototype.pushCallNavigation_ = function (roomId, roomLink) {
  if (!isChromeApp()) {
    window.history.pushState({'roomId': roomId, 'roomLink': roomLink}, roomId,
      roomLink);
  }
};

AppController.prototype.displaySharingInfo_ = function (roomId, roomLink) {
  this.roomLinkHref_.href = roomLink;
  this.roomLinkHref_.text = roomLink;
  this.roomLink_ = roomLink;
  this.pushCallNavigation_(roomId, roomLink);
  this.activate_(this.sharingDiv_);
};

AppController.prototype.displayStatus_ = function (status) {
  if (status === '') {
    this.deactivate_(this.statusDiv_);
  } else {
    this.activate_(this.statusDiv_);
  }
  this.statusDiv_.innerHTML = status;
};

AppController.prototype.displayError_ = function (error) {
  trace(error);
  this.infoBox_.pushErrorMessage(error);
};

AppController.prototype.toggleAudioMute_ = function () {
  this.call_.toggleAudioMute();
  this.muteAudioIconSet_.toggle();
};

AppController.prototype.toggleVideoMute_ = function () {
  this.call_.toggleVideoMute();
  this.muteVideoIconSet_.toggle();
};

AppController.prototype.toggleFullScreen_ = function () {
  if (isFullScreen()) {
    trace('Exiting fullscreen.');
    document.querySelector('svg#fullscreen title').textContent =
      'Enter fullscreen';
    document.cancelFullScreen();
  } else {
    trace('Entering fullscreen.');
    document.querySelector('svg#fullscreen title').textContent =
      'Exit fullscreen';
    document.body.requestFullScreen();
  }
  this.fullscreenIconSet_.toggle();
};

AppController.prototype.toggleMiniVideo_ = function () {
  if (this.miniVideo_.classList.contains('active')) {
    this.deactivate_(this.miniVideo_);
  } else {
    this.activate_(this.miniVideo_);
  }
};

AppController.prototype.hide_ = function (element) {
  element.classList.add('hidden');
};

AppController.prototype.show_ = function (element) {
  element.classList.remove('hidden');
};

AppController.prototype.activate_ = function (element) {
  element.classList.add('active');
};

AppController.prototype.deactivate_ = function (element) {
  element.classList.remove('active');
};

AppController.prototype.showIcons_ = function () {
  if (!this.icons_.classList.contains('active')) {
    this.activate_(this.icons_);
    this.setIconTimeout_();
  }
};

AppController.prototype.hideIcons_ = function () {
  if (this.icons_.classList.contains('active')) {
    this.deactivate_(this.icons_);
  }
};

AppController.prototype.setIconTimeout_ = function () {
  if (this.hideIconsAfterTimeout) {
    window.clearTimeout.bind(this, this.hideIconsAfterTimeout);
  }
  this.hideIconsAfterTimeout = window.setTimeout(function () {
    this.hideIcons_();
  }.bind(this), 5000);
};

AppController.prototype.iconEventSetup_ = function () {
  this.icons_.onmouseenter = function () {
    window.clearTimeout(this.hideIconsAfterTimeout);
  }.bind(this);

  this.icons_.onmouseleave = function () {
    this.setIconTimeout_();
  }.bind(this);
};

AppController.prototype.loadUrlParams_ = function () {
  /* eslint-disable dot-notation */
  // Suppressing eslint warns about using urlParams['KEY'] instead of
  // urlParams.KEY, since we'd like to use string literals to avoid the Closure
  // compiler renaming the properties.
  var DEFAULT_VIDEO_CODEC = 'VP9';
  var urlParams = queryStringToDictionary(window.location.search);
  this.loadingParams_.audioSendBitrate = urlParams['asbr'];
  this.loadingParams_.audioSendCodec = urlParams['asc'];
  this.loadingParams_.audioRecvBitrate = urlParams['arbr'];
  this.loadingParams_.audioRecvCodec = urlParams['arc'];
  this.loadingParams_.opusMaxPbr = urlParams['opusmaxpbr'];
  this.loadingParams_.opusFec = urlParams['opusfec'];
  this.loadingParams_.opusDtx = urlParams['opusdtx'];
  this.loadingParams_.opusStereo = urlParams['stereo'];
  this.loadingParams_.videoSendBitrate = urlParams['vsbr'];
  this.loadingParams_.videoSendInitialBitrate = urlParams['vsibr'];
  this.loadingParams_.videoSendCodec = urlParams['vsc'];
  this.loadingParams_.videoRecvBitrate = urlParams['vrbr'];
  this.loadingParams_.videoRecvCodec = urlParams['vrc'] || DEFAULT_VIDEO_CODEC;
  this.loadingParams_.videoFec = urlParams['videofec'];

  this.loadingParams_.libvpx = urlParams['libvpx'];
  this.loadingParams_.packet = urlParams['packet']; // 16 (KB)
  this.loadingParams_.videoCodec = urlParams['codec']; // vp8, vp9, etc.
  this.loadingParams_.videoWidth = urlParams['width']; // 640
  this.loadingParams_.videoHeight = urlParams['height']; // 480
  this.loadingParams_.videoFps = urlParams['fps']; // 30
  this.loadingParams_.webrtc = urlParams['webrtc'];
  this.loadingParams_.webrtcVideo = urlParams['webrtcvideo']
  /* eslint-enable dot-notation */
};

AppController.IconSet_ = function (iconSelector) {
  this.iconElement = document.querySelector(iconSelector);
};

AppController.IconSet_.prototype.toggle = function () {
  if (this.iconElement.classList.contains('on')) {
    this.iconElement.classList.remove('on');
    // turn it off: CSS hides `svg path.on` and displays `svg path.off`
  } else {
    // turn it on: CSS displays `svg.on path.on` and hides `svg.on path.off`
    this.iconElement.classList.add('on');
  }
};
