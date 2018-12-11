/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

importScripts('/wasm/libvpx/libvpx.js');

const KB = 0x400; // 2**10
const MB = KB * KB;
const MAX_IVF_SIZE = 1 * MB;

const Codecs = {
  VP8: 0x30385056,
  VP9: 0x30395056,
};

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
    this._ivfPtr = 0;

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

  encode(rgbaData) {
    const codec = this.codec;
    const width = this.width;
    const height = this.height;
    const fourcc = Codecs[codec];
    const rgbaSize = width * height * 4;

    rgbaData = new Uint8Array(rgbaData);

    if (rgbaData.length != rgbaSize)
      console.warn('Wrong RGBA data size:', rgbaData.length);

    if (!this._encInitialized) {
      console.warn('initializing vpx encoder');
      _vpx_js_encoder_open(fourcc, width, height, this.fps || 30,
          this.bitrate || 200);
      this._encInitialized = true;
    }

    this._ivfPtr = this._ivfPtr || _malloc(MAX_IVF_SIZE);
    this._rgbPtr = this._rgbPtr || _malloc(rgbaSize);
    HEAP8.set(rgbaData, this._rgbPtr);
    const ivfSize = _vpx_js_encoder_run(this._rgbPtr, this._ivfPtr, MAX_IVF_SIZE);
    return new Uint8Array(HEAP8.buffer, this._ivfPtr, ivfSize);
  }

  decode(ivfData) {
    const fourcc = Codecs[this.codec];
    const width = this.width;
    const height = this.height;
    const rgbaSize = width * height * 4;

    ivfData = new Uint8Array(ivfData);

    if (!this._decInitialized) {
      console.warn('initializing vpx decoder');
      _vpx_js_decoder_open(fourcc, width, height, this.fps || 30);
      this._decInitialized = true;
    }

    this._ivfPtr = this._ivfPtr || _malloc(MAX_IVF_SIZE);
    this._rgbPtr = this._rgbPtr || _malloc(rgbaSize);
    HEAP8.set(ivfData, this._ivfPtr);
    _vpx_js_decoder_run(this._rgbPtr, this._ivfPtr, ivfData.length);
    return new Uint8Array(HEAP8.buffer, this._rgbPtr, rgbaSize);
  }
}

new LibVPX();
