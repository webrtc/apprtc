/*
 *  Copyright (c) 2018 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* exported WebRTC */

'use strict';

const framesPerPacket = 512;
const receivingSamplesPerCallback = 2048;

class WebRTC {
  constructor(sendVideo, miniVideo) {
    // TODO: Consider changing width & height.
    this.width = 640;
    this.height = 480;
    this.fps = 10;
    this.sendVideo = sendVideo;
    // $(UI_CONSTANTS.miniVideo) from appcontroller.js.
    this.miniVideo = miniVideo;
    this._loadWasm('/wasm/webrtc/webrtc.js');
  }

  _loadWasm(src) {
    console.warn('loading wasm module:', src);
    const time = Date.now();
    const script = document.createElement('script');
    script.src = src;

    script.onerror = () => {
      console.warn('failed to load the script:', src);
    };

    script.onload = () => {
      console.log('script loaded, waiting for wasm...');

      Module.onRuntimeInitialized = () => {
        console.warn('webrtc.wasm loaded:', Date.now() - time, 'ms');
        console.log('wasm module:', Module);
        this._showTheStartButton();
      };
    };

    document.body.appendChild(script);
  }

  _showTheStartButton() {
    console.log('Click the button to start the WebRTC stuff.');
    const button = document.createElement('button');
    button.setAttribute('style', 'position:fixed;left:10px;top:10px');
    button.textContent = 'Start WebRTC';
    document.body.append(button);
    button.addEventListener('click', () => this.start());
  }

  start() {
    var call = undefined;
    const Transport = Module.Transport.extend("Transport", {
      __construct: function () {
        this.__parent.__construct.call(this);

        if (!window.dc) {
          console.warn('window.dc:RTCDataChannel doesnt exist yet');
          return;
        }

        console.warn('Subscribing to RTP packets');
        dc.onmessage = event => {
          const time = Date.now();
          const packet = new Uint8Array(event.data);
          uistats.rtpRecvSize.set(packet.length);
          console.log('Received a RTP packet:', packet.length, 'bytes');
          console.log(packet);
          let receivedBuffer = new Module.VectorUint8();
          for (i = 0; i < packet.length; i++) {
            receivedBuffer.push_back(packet[i]);
          }
          call.deliverPacket(receivedBuffer);
          uistats.audioDecTime.set(Date.now() - time);
        };
      },
      __destruct: function () {
        this.__parent.__destruct.call(this);
      },
      sendPacket: function (payload) {
        console.log('sendPacket');
        // console.log(payload);
        console.log('Sending a RTP packet:', payload.length, 'bytes');
        uistats.rtpSendSize.set(payload.length);
        // console.log('Sending a RTP packet:', payload.length, 'bytes');
        if (window.dc) {
          const payloadCopy = new Uint8Array(payload);
          dc.send(payloadCopy);
        } else {
          console.warn(`window.dc:RTCDataChannel doesn't exist yet`);
        }
        return true;
      },
    });
    let audioDeviceModule = Module.createAudioDeviceModule();
    audioDeviceModule.startPlayout();
    call = new Module.Call(new Transport(), audioDeviceModule);
    let audioSendStream = call.createAudioSendStream({
      ssrc: 123,
      cname: 'cname',
      payloadType: 42,
      codecName: 'opus',
      clockrateHz: 48000,
      numChannels: 2,
    });
    audioSendStream.start();

    let videoSendStream = call.createVideoSendStream({
      ssrc: 234,
    });
    videoSendStream.start();

    function intToFloat(intSample) {
      return intSample / 32768;
    }

    function floatToInt(floatSample) {
      s = Math.max(-1, Math.min(1, floatSample));
      return s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    function startSendingVideo(width, height, fps, miniVideo) {
      console.log('Starting to send VideoFrames on wasm VideoSendStream...');
      const sendFrame = () => {
        const localCanvas = document.createElement('canvas');
        localCanvas.width = width;
        localCanvas.height = height;
        const localContext2d = localCanvas.getContext('2d');
        if (dc === undefined || dc.readyState != 'open')
          return;
        localContext2d.drawImage(miniVideo, 0, 0, width, height);
        const {data: rgba} = localContext2d.getImageData(0, 0, width, height);
        console.log('Sending raw video frame', rgba);

        const rgbaSize = width * height * 4;
        // const yuvSize = this.width * this.height * 3 / 2; // 48 bits per 4 pixels
        if (rgba.length != rgbaSize)
          console.warn('Wrong RGBA data size:', rgba.length);

        let videoData = new Module.VectorUint8();
        for (let i = 0; i < rgba; i++) {
          videoData.push_back(rgba[i]);
        }
        // TODO:Passing in 0 as a timestamp, could be causing the frames to get dropped.
        const videoFrame = new Module.VideoFrame(0, width, height);
        videoFrame.setRgbData(videoData);
        videoSendStream.sendVideoFrame(videoFrame);
        delete videoFrame;
      };

      if (fps > 0) {
        setInterval(sendFrame, 1000 / fps);
      } else {
        const button = document.createElement('button');
        button.setAttribute('style', 'position:fixed;left:10px;top:10px');
        button.textContent = 'Send Frame';
        document.body.append(button);
        button.addEventListener('click', () => sendFrame());
      }
      // TODO: Receiver w/ remote data.
    }

    function sendAudio(floatBufferChannel1, floatBufferChannel2) {
      // buffer in
      for (let i = 0; i < floatBufferChannel1.length; i++) {
        sendingQueue.push(floatToInt(floatBufferChannel1[i]));
        sendingQueue.push(floatToInt(floatBufferChannel2[i]));
      }

      // while we have something in the queue, send it right away! hopefully
      // webrtc is ok with that.
      let sendBuffer = new Module.VectorInt16();
      for (let i = 0; i < 2 * 480; i++) {
        sendBuffer.push_back(sendingQueue[i]);
      }

      while(sendingQueue.length > 2 * 480) {
        console.log("sending packet, current_length=" + sendingQueue.length);
        sendingQueue.splice(0, 2 * 480);

        const audioFrame = new Module.AudioFrame();
        audioFrame.setNumChannels(2);
        audioFrame.setSampleRateHz(48000);
        audioFrame.setSamplesPerChannel(sendBuffer.size() / 2);
        audioFrame.setData(sendBuffer);
        audioSendStream.sendAudioData(audioFrame);
      }

      // best garbage collection I can think of
      sendBuffer.delete();
    }

    let receiveAudioCodecs = new Module.VectorAudioCodec();
    receiveAudioCodecs.push_back({
      payloadType: 42,
      name: 'opus',
      clockrateHz: 48000,
      numChannels: 2,
    });
    let receiveStream = call.createAudioReceiveStream({
      localSsrc: 345,
      remoteSsrc: 123,
      codecs: receiveAudioCodecs,
    });

    receiveStream.start();

    var sendingQueue = [];
    var receivingQueueChannel1 = [];
    var receivingQueueChannel2 = [];
    function startSendingAudio(sendVideo) {
      console.warn('Activating webrtc audio');
      if (navigator.mediaDevices) {
        console.warn('Activating webrtc audio');

        console.log('getUserMedia supported.');
        navigator.mediaDevices.getUserMedia({audio: true, video: false})
            .then(function (stream) {
              console.log("created stream!");
              var audioCtx = new AudioContext();
              var source = audioCtx.createMediaStreamSource(stream);
              var processor = audioCtx.createScriptProcessor(framesPerPacket, 2, 2);
              // var processor = stream.context.createScriptProcessor(0, 1, 1);
              source.connect(processor).connect(audioCtx.destination);
              processor.onaudioprocess = function (e) {
                var channelData = e.inputBuffer.getChannelData(0);
                var channelData2 = e.inputBuffer.getChannelData(0);
                // console.log('captured audio ' + channelData.length);
                // console.log(channelData);
                sendAudio(channelData, channelData2);
              }

              // And playback, hacky, using script processor
              var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              destination = audioCtx.createMediaStreamDestination();
              var playbackProcessor = audioCtx.createScriptProcessor(receivingSamplesPerCallback, 2, 2);
              var oscillator = audioCtx.createOscillator();
              oscillator.type = 'square';
              oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // value in hertz
              oscillator.connect(playbackProcessor).connect(audioCtx.destination);
              playbackProcessor.onaudioprocess = function (e) {
                var outputBuffer = e.outputBuffer;
                var channel1 = outputBuffer.getChannelData(0);
                var channel2 = outputBuffer.getChannelData(1);
                let numberOfPulls = channel1.length / 480;
                var offset = 0;
                for(i=0; i < numberOfPulls; i++) {
                  const audioFrame = new Module.AudioFrame();
                  audioFrame.setNumChannels(2);
                  audioFrame.setSampleRateHz(48000);
                  audioFrame.setSamplesPerChannel(480);

                  // pre-allocate!
                  for (let i = 0; i < 480 * 2; i++) {
                    audioFrame.data().push_back(0);
                  }

                  audioDeviceModule.pullRenderData(audioFrame);

                  for(var s = 0; s < audioFrame.data().size() / 2; s++) {
                    receivingQueueChannel1.push(intToFloat(audioFrame.data().get(s*2)));
                    receivingQueueChannel2.push(intToFloat(audioFrame.data().get(s*2+1)));
                  }
                }

                if(receivingQueueChannel1.length > receivingSamplesPerCallback) {
                for(var i=0; i < receivingSamplesPerCallback; i++) {
                  channel1[i] = receivingQueueChannel1[i];
                  channel2[i] = receivingQueueChannel2[i];
                }
                receivingQueueChannel1.splice(0, receivingSamplesPerCallback);
                receivingQueueChannel2.splice(0, receivingSamplesPerCallback);
                }
              }
            oscillator.start();
          });
      }
    }
    startSendingAudio();
    if (this.sendVideo) {
      startSendingVideo(this.width, this.height, this.fps, this.miniVideo);
    }
  };
}
