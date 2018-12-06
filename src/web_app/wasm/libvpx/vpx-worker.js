/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

importScripts('/wasm/libvpx/libvpx.js');

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
    this.bitrate = 1000; // kbit/s, ivf packet size = bitrate/fps

    this._encInitialized = false;
    this._decInitialized = false;
    this._rgbPtr = 0;
    this._yuvPtr = 0;
    this._yuvFrame = null; // UInt8Array
    this._ivfFrame = null; // UInt8Array, dynamic

    onmessage = event => {
      const req = event.data;
      // console.log('Received web worker request:', req);
      const {id} = req;

      try {
        let res = this._handleWebWorkerRequest(req);

        if (res instanceof Uint8Array) {
          // Copying the entire result buffer every time is a bad idea, but it's
          // much better than letting postMessage serialize it to JSON and then
          // deserialize it back on the appcontroller.js side.
          res = new Uint8Array(res);
          postMessage({ id, res: res.buffer }, [res.buffer]);
        } else {
          postMessage({ id, res });
        }
      } catch (err) {
        postMessage({ id, err });
      }
    };
  }

  _handleWebWorkerRequest(req) {
    switch (req.type) {
      case 'init':
        const data = req.data;
        console.log('Updating props:', data);
        Object.assign(this, data);
        return;
      case 'call':
        // console.log('Invoking', req.name, req.args);
        return this[req.name](...req.args);
      default:
        throw new Error('Unrecognized request type.');
    }
  }

  _allocIvfFrame(size) {
    if (!this._ivfFrame || this._ivfFrame.length < size)
      this._ivfFrame = new Uint8Array(size);
    return new Uint8Array(this._ivfFrame.buffer, 0, size);
  }

  encode(rgbaData, keyframe = false) {
    rgbaData = new Uint8Array(rgbaData);

    const codec = this.codec;
    const width = this.width;
    const height = this.height;
    const fourcc = Codecs[codec];
    const rgbaSize = width * height * 4;
    const yuvSize = width * height * 3 / 2; // 48 bits per 4 pixels

    if (rgbaData.length != rgbaSize)
      console.warn('Wrong RGBA data size:', rgbaData.length);

    if (!this._encInitialized) {
      console.warn('initializing vpx encoder');
      _vpx_js_encoder_open(fourcc, width, height, this.fps || 30,
          this.bitrate || 200);
      this._encInitialized = true;
    }

    // - Copy RGBA data to the WASM memory.
    // - Convert RGBA to YUV.
    // - Copy YUV data to the in-memory /vpx-yuv file.
    this._rgbPtr = this._rgbPtr || _malloc(rgbaSize);
    this._yuvPtr = this._yuvPtr || _malloc(yuvSize);
    HEAP8.set(rgbaData, this._rgbPtr);
    _vpx_js_rgba_to_yuv420(this._yuvPtr, this._rgbPtr, width, height);
    const yuvData = new Uint8Array(HEAP8.buffer, this._yuvPtr, yuvSize);
    FS.writeFile(ENC_YUV_FILE, yuvData); // in-memory memfs emscripten file

    // more keyframes = better video quality
    _vpx_js_encoder_run(keyframe ? 1 : 0);

    // Read IVF data from the file.

    const ivfSize = FS.stat(ENC_IVF_FILE).size;
    const ivfFile = FS.open(ENC_IVF_FILE, 'r');
    const ivfData = this._allocIvfFrame(ivfSize);
    FS.read(ivfFile, ivfData, 0, ivfData.length);
    FS.close(ivfFile);

    return ivfData;
  }

  decode(ivfData) {
    const fourcc = Codecs[this.codec];
    const width = this.width;
    const height = this.height;
    const rgbaSize = width * height * 4;

    if (!this._decInitialized) {
      console.warn('initializing vpx decoder');
      _vpx_js_decoder_open(fourcc, width, height, this.fps || 30);
      this._decInitialized = true;
    }

    FS.writeFile(DEC_IVF_FILE, new Uint8Array(ivfData));

    this._rgbPtr = this._rgbPtr || _malloc(rgbaSize);
    _vpx_js_decoder_run(this._rgbPtr);
    return new Uint8Array(HEAP8.buffer, this._rgbPtr, rgbaSize);
  }
}

new LibVPX();
