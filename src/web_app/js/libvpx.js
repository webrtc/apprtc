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

const Codecs = {
  VP8: 0x30385056,
  VP9: 0x30395056,
};

const ENC_IVF_FILE = "/vpx-enc-ivf"; // vpx encoder writes here
const ENC_YUV_FILE = "/vpx-enc-yuv"; // vpx encoder read here
const DEC_IVF_FILE = "/vpx-dec-ivf"; // vpx decoder reads here
const DEC_YUV_FILE = "/vpx-dec-yuv"; // vpx decoder writes here

class LibVPX {
  constructor() {
    this.codec = 'vp8';
    this.width = 640;
    this.height = 480;
    this.fps = 10;

    this._encInitialized = false;
    this._decInitialized = false;
    this._lastIvfSize = 0;

    this._loadWasm('/wasm/libvpx/libvpx.js');
  }

  _loadWasm(src) {
    console.warn('loading wasm module:', src);
    loadScript(src).then(() => {
      Module.onRuntimeInitialized = () => {
        console.warn('libvpx.wasm loaded');
        console.log('wasm module:', Module);
      };
    });
  }

  encode(rgbaData) {
    const codec = this.codec;
    const width = this.width;
    const height = this.height;
    const fourcc = Codecs[codec];
    const rgbaSize = width * height * 4;
    const yuvSize = width * height * 3 / 2; // 48 bits per 4 pixels

    if (rgbaData.length != rgbaSize)
      console.warn('Wrong RGBA data size:', rgbaData.length);

    // console.log(`Encoding ${width}x${height} with ${codec} fourcc:${fourcc}`);

    if (!this._encInitialized) {
      console.warn('initializing vpx encoder');
      _vpx_js_encoder_open(fourcc, width, height, this.fps || 30);
      this._encInitialized = true;
    }

    // - Copy RGBA data to the WASM memory.
    // - Convert RGBA to YUV.
    // - Copy YUV data to the in-memory /vpx-yuv file.
    const rgbaPtr = _malloc(rgbaSize);
    const yuvPtr = _malloc(yuvSize);
    HEAP8.set(rgbaData, rgbaPtr);
    _vpx_js_rgba_to_yuv420(yuvPtr, rgbaPtr, width, height);
    const yuvData = new Uint8Array(HEAP8.buffer, yuvPtr, yuvSize);
    FS.writeFile(ENC_YUV_FILE, yuvData); // in-memory memfs emscripten file
    _free(rgbaPtr);
    _free(yuvPtr);

    const forceKeyframe = 0;
    _vpx_js_encoder_run(forceKeyframe);

    const ivfSize = FS.stat(ENC_IVF_FILE).size;
    const ivfFile = FS.open(ENC_IVF_FILE, 'r');
    const ivfData = new Uint8Array(ivfSize - this._lastIvfSize);
    FS.read(ivfFile, ivfData, 0, ivfData.length, this._lastIvfSize);
    FS.close(ivfFile);
    this._lastIvfSize = ivfSize;

    // console.log(ENC_YUV_FILE, 'size:', FS.stat(ENC_YUV_FILE).size >> 10, 'KB');
    // console.log(ENC_IVF_FILE, 'size:', FS.stat(ENC_IVF_FILE).size >> 10, 'KB');

    return ivfData;
  }

  decode(ivfData) {
    const width = this.width;
    const height = this.height;
    const rgbaSize = width * height * 4;
    const yuvSize = width * height * 3 / 2; // 48 bits per 4 pixels

    // Append new IVF data to the /vpx-ivf file.

    const ivfFile = FS.open(DEC_IVF_FILE, 'a');
    const ivfSize = FS.stat(DEC_IVF_FILE).size;
    FS.write(ivfFile, ivfData, 0, ivfData.length, ivfSize);
    FS.close(ivfFile);

    if (!this._decInitialized) {
      console.warn('initializing vpx decoder');
      _vpx_js_decoder_open();
      this._decInitialized = true;
    }

    // Run the VPX decoder.

    _vpx_js_decoder_run();

    // Read the new YUV frames written by the decoder.

    const yuvFrames = FS.readFile(DEC_YUV_FILE);
    if (yuvFrames.length % yuvSize != 0)
      console.warn('Wrong YUV size:', yuvFrames.length, '%', yuvSize, '!= 0');

    // Convert YUV frames to RGB frames.

    const rgbaPtr = _malloc(rgbaSize);
    const yuvPtr = _malloc(yuvSize);
    const rgbaFrames = [];

    for (let frameId = 0; frameId < yuvFrames.length / yuvSize; frameId++) {
      const yuvData = yuvFrames.slice(
        frameId * yuvSize, (frameId + 1) * yuvSize);
      HEAP8.set(yuvData, yuvPtr);
      _vpx_js_yuv420_to_rgba(rgbaPtr, yuvPtr, width, height);
      const rgbaData = new Uint8Array(HEAP8.buffer, rgbaPtr, rgbaSize);
      rgbaFrames.push(rgbaData);
    }

    _free(rgbaPtr);
    _free(yuvPtr);

    // console.log(DEC_IVF_FILE, 'size:', FS.stat(DEC_IVF_FILE).size >> 10, 'KB');
    // console.log(DEC_YUV_FILE, 'size:', FS.stat(DEC_YUV_FILE).size >> 10, 'KB');

    return rgbaFrames;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onerror = reject;
    script.onload = resolve;
    document.body.appendChild(script);
  });
}
