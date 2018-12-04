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
        const Transport = Module.Transport.extend("Transport", {
          __construct: function() {
            this.__parent.__construct.call(this);
          },
          __destruct: function() {
            this.__parent.__destruct.call(this);
          },
          sendPacket: function(payload) {
            console.log('sendPacket');
            console.log(payload);
            return true;
          },
        });
        let call = new Module.Call(new Transport());
        let sendStream = call.createAudioSendStream({
          ssrc: 123,
          cname: "cname",
          payloadType: 42,
          codecName: "opus",
          clockrateHz: 48000,
          numChannels: 2,
        });
        function sendSomeAudio(offset) {
          let sendBuffer = new Module.VectorInt16();
          for (let i = 0; i < 480 * 2; i++) {
            sendBuffer.push_back(offset + i);
          }
          console.log('sending audio');
          sendStream.sendAudioData({
            data: sendBuffer,
            sampleRate: 48000,
            numberOfChannels: 2,
            numberOfFrames: 480,
          });
          setTimeout(() => sendSomeAudio((offset + 10) % 100 - 50), 500);
        }
        setTimeout(() => sendSomeAudio(0), 500);
      };
    };

    document.body.appendChild(script);
  }

  _onBodyClick() {
    console.warn('initializing libvpx');

    const VP8 = 0x30385056;
    const width = 640;
    const height = 480;
    const yuvdata = new Uint8Array(width * height * 3 / 2);

    FS.writeFile('/vpx-yuv', yuvdata); // in-memory memfs emscripten file

    _vpx_js_encoder_init(VP8, width, height);
    _vpx_js_encoder_process();
    _vpx_js_encoder_exit(); // flushes all memory buffers, etc.

    const ivfdata = FS.readFile('/vpx-ivf');
    console.log('IVF data:', ivfdata);
  }
}
