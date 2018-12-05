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

class WebRTC {
  constructor() {
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
    let sendStream = call.createAudioSendStream({
      ssrc: 123,
      cname: 'cname',
      payloadType: 42,
      codecName: 'opus',
      clockrateHz: 48000,
      numChannels: 2,
    });
    sendStream.start();

    function intToFloat(intSample) {
      return intSample / 32768;
    }

    function floatToInt(floatSample) {
      s = Math.max(-1, Math.min(1, floatSample));
      return s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    function sendAudio(floatBufferChannel1, floatBufferChannel2) {
      // buffer in
      console.log("sending audio");
      assert(floatBufferChannel1.length == floatBufferChannel2.length);
      assert(floatBufferChannel1.length >= 480);

      let sendBuffer = new Module.VectorInt16();
      for (let i = 0; i < 480; i++) {
        sendBuffer.push_back(floatToInt(floatBufferChannel1[i]));
        sendBuffer.push_back(floatToInt(floatBufferChannel2[i]));
      }
      // ignores the rest of the buffer for now!
      // TODO
      const audioFrame = new Module.AudioFrame();
      audioFrame.setNumChannels(2);
      audioFrame.setSampleRateHz(48000);
      audioFrame.setSamplesPerChannel(480);
      audioFrame.setData(sendBuffer);

      sendStream.sendAudioData(audioFrame);
    }

    function sendSomeAudio(offset) {
      let sendBuffer = new Module.VectorInt16();
      for (let i = 0; i < 480 * 2; i++) {
        sendBuffer.push_back(offset + i);
      }
      console.log('sending audio');
      sendStream.sendAudioData({
        data: sendBuffer,
        numChannels: 2,
        sampleRateHz: 48000,
        samplesPerChannel: 480,
        timestamp: 0,
      });
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

    function startSending() {
      console.warn('Activating webrtc audio');
      if (navigator.mediaDevices) {
        console.warn('Activating webrtc audio');

        console.log('getUserMedia supported.');
        navigator.mediaDevices.getUserMedia({audio: true, video: false})
          .then(function (stream) {
            /*
               var audioCtx = new AudioContext();
               audioCtx.audioWorklet.addModule("js/wasm-worklet-processor.js");
               var source = audioCtx.createMediaStreamSource(stream);
               const processor = new AudioWorkletNode(context, 'wasm-processor');
               source.connect(processor).connect(context.destination);
               source.start();
               */
            console.log("created stream!");
            var audioCtx = new AudioContext();
            var source = audioCtx.createMediaStreamSource(stream);
            var processor = audioCtx.createScriptProcessor(0, 2, 2);
            // var processor = stream.context.createScriptProcessor(0, 1, 1);
            source.connect(processor).connect(audioCtx.destination);
            processor.onaudioprocess = function (e) {
              const time = Date.now();
              var channelData = e.inputBuffer.getChannelData(0);
              var channelData2 = e.inputBuffer.getChannelData(0);
              // console.log('captured audio ' + channelData.length);
              // console.log(channelData);
              sendAudio(channelData, channelData2);
              uistats.audioEncTime.set(Date.now() - time);
            }

            // And playback, hacky, using script processor
            var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            destination = audioCtx.createMediaStreamDestination();
            var playbackProcessor = audioCtx.createScriptProcessor(0, 2, 2);
            var oscillator = audioCtx.createOscillator();
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // value in hertz
            oscillator.connect(playbackProcessor).connect(audioCtx.destination);
            playbackProcessor.onaudioprocess = function (e) {
              const audioFrame = new Module.AudioFrame();
              audioFrame.setNumChannels(2);
              audioFrame.setSampleRateHz(48000);
              audioFrame.setSamplesPerChannel(480);
              console.log('before: ' + audioFrame.data().size());

              // pre-allocate!
              for (let i = 0; i < 480 * 2; i++) {
                audioFrame.data().push_back(0);
              }

              audioDeviceModule.pullRenderData(audioFrame);
              console.log('after: ' + audioFrame.data().size());
              var outputBuffer = e.outputBuffer;
              var channel1 = outputBuffer.getChannelData(0);
              var channel2 = outputBuffer.getChannelData(1);

              for (var s = 0; s < audioFrame.data().size() / 2; s++) {
                channel1[s] = intToFloat(audioFrame.data().get(s * 2));
                channel2[s] = intToFloat(audioFrame.data().get(s * 2 + 1));
              }
              console.log(audioFrame.data().get(0));
            }
            oscillator.start();
          });
      }
    }
    startSending();
  };
}
