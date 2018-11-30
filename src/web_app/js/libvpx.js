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
      };
    };

    document.body.appendChild(script);
  }

  encode(videoElement) {
    const VP8 = 0x30385056;
    const width = 640;
    const height = 480;

    // - Take a video frame from <video> to <canvas>.
    // - Copy RGBA data to the WASM memory.
    // - Convert RGBA to YUV.
    // - Copy YUV data to the in-memory /vpx-yuv file.
    console.log('taking a rgba video frame');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context2d = canvas.getContext('2d');
    context2d.drawImage(videoElement, 0, 0, width, height);
    const {data:rgbaData} = context2d.getImageData(0, 0, width, height);
    console.log('RGB data:', rgbaData);
    const rgbaSize = width * height * 4;
    const yuvSize = width * height * 3 / 2; // 48 bits per 4 pixels
    const rgbaPtr = _malloc(rgbaSize);
    const yuvPtr = _malloc(yuvSize);
    HEAP8.set(rgbaData, rgbaPtr);
    _vpx_js_rgba_to_yuv420(yuvPtr, rgbaPtr, width, height);
    const yuvData = new Uint8Array(HEAP8.buffer, yuvPtr, yuvSize);
    console.log('YUV data:', yuvData);
    FS.writeFile('/vpx-yuv', yuvData); // in-memory memfs emscripten file
    _free(rgbaPtr);
    _free(yuvPtr);

    console.warn('initializing libvpx');
    _vpx_js_encoder_init(VP8, width, height);
    _vpx_js_encoder_process();
    _vpx_js_encoder_exit(); // flushes all memory buffers, etc.

    const ivfData = FS.readFile('/vpx-ivf');
    console.log('IVF data:', ivfData);
  }
}
