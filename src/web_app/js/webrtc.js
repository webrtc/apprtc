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
      setTimeout(() => sendSomeAudio((offset + 10) % 100 - 50), 1000);
    }
    setTimeout(() => sendSomeAudio(0), 1000);

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
  };
}
