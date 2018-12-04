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
    const script = document.createElement('script');
    script.src = src;

    script.onerror = () => {
      console.warn('failed to load the script');
    };

    script.onload = () => {
      console.log('script loaded, waiting for wasm...');

      Module.onRuntimeInitialized = () => {
        console.warn('webrtc.wasm loaded');
        console.log('wasm module:', Module);
        this._onWasmLoaded();
      };

    };

    document.body.appendChild(script);
  }

  _onWasmLoaded() {
    const Transport = Module.Transport.extend("Transport", {
      __construct: function () {
        this.__parent.__construct.call(this);
      },
      __destruct: function () {
        this.__parent.__destruct.call(this);
      },
      sendPacket: function (payload) {
        console.log('sendPacket');
        console.log(payload);
        let payloadCopy = new Module.VectorUint8();
        for (let i = 0; i < payload.length; i++) {
          payloadCopy.push_back(payload[i]);
        }
        call.deliverPacket(payloadCopy);
        return true;
      },
    });
    var call = new Module.Call(new Transport());
    let sendStream = call.createAudioSendStream({
      ssrc: 123,
      cname: 'cname',
      payloadType: 42,
      codecName: 'opus',
      clockrateHz: 48000,
      numChannels: 2,
    });
    sendStream.start();

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
            sendBuffer[i*2] = floatToInt(floatBufferChannel1[i]);
            sendBuffer[i*2+1] = floatToInt(floatBufferChannel2[i]);
          }
          // ignores the rest of the buffer for now!
          // TODO

          sendStream.sendAudioData({
            data: sendBuffer,
            numChannels: 2,
            sampleRateHz: 48000,
            samplesPerChannel: 480,
            timestamp: 0,
          });
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

    const AudioSink =
      Module.AudioReceiveStreamSink.extend("AudioReceiveStreamSink", {
        __construct: function () {
          this.__parent.__construct.call(this);
        },
        __destruct: function () {
          this.__parent.__destruct.call(this);
        },
        onAudioFrame: function (audioFrame) {
          console.log('onAudioFrame');
          console.log(audioFrame);
        },
      });

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
    receiveStream.setSink(new AudioSink());
    receiveStream.start();
        function startSending() {
          console.warn('Activating webrtc audio');
          if (navigator.mediaDevices) {
            console.warn('Activating webrtc audio');

            console.log('getUserMedia supported.');
            navigator.mediaDevices.getUserMedia({audio: true, video: false})
                .then(function(stream) {
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
                  processor.onaudioprocess = function(e) {
                    var channelData = e.inputBuffer.getChannelData(0);
                    var channelData2 = e.inputBuffer.getChannelData(0);
                    // console.log('captured audio ' + channelData.length);
                    // console.log(channelData);
                    sendAudio(channelData, channelData2);
                  }
                });
          }
        }
        startSending();
  };
}
