/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* exported LibVPX */

'use strict';

class LibVPX {
  constructor() {
    this._loadWasm('/wasm/libvpx/libvpx.js');
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
        console.warn('libvpx.wasm loaded');
        console.log('wasm module:', Module);
        console.log('click somewhere to call libvpx.wasm');
        document.body.addEventListener('click', () => this._onBodyClick());
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
