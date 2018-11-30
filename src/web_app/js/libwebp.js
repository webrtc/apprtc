/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals trace, mergeConstraints, parseJSON */

/* exported LibWebP */

'use strict';

var LibWebP = function() {
  const src = '/wasm/libwebp/a.out.js';
  console.warn('loading wasm module:', src);
  const script = document.createElement('script');
  script.src = src;

  script.onerror = () => {
    console.warn('failed to load the script');
  };

  script.onload = () => {
    console.log('script loaded, waiting for wasm...');

    Module.onRuntimeInitialized = () => {
      console.warn('libwebp.version', '0x' + _version().toString(16));
    };
  };

  document.body.appendChild(script);
};

LibWebP.prototype.encode = function(image) {
  const sourcePtr = Module._create_buffer(image.width, image.height);
  Module.HEAP8.set(image.data, sourcePtr);

  const quality = 100;
  Module._encode(sourcePtr, image.width, image.height, quality);
  Module._destroy_buffer(sourcePtr);

  const resultPtr = Module._get_result_pointer();
  const resultSize = Module._get_result_size();
  const resultView = new Uint8Array(Module.HEAP8.buffer, resultPtr, resultSize);
  const result = new Uint8Array(resultView);
  Module._free_result(resultPtr);

  return result;
};

LibWebP.prototype.decode = function(buffer) {
  const size = buffer.length;
  const sourcePtr = Module._create_buffer(size, 1);
  Module.HEAP8.set(buffer, sourcePtr);
  Module._decode(sourcePtr, size);
  Module._destroy_buffer(sourcePtr);

  const resultPtr = Module._get_result_pointer();
  if (!resultPtr) throw new Error('Invalid LibWebP image.');

  const width = Module._get_result_width();
  const height = Module._get_result_height();
  const resultView = new Uint8Array(Module.HEAP8.buffer, resultPtr, width*height*4);
  const result = new Uint8Array(resultView);
  Module._free_result(resultPtr);

  return {data:result, width, height};
};
