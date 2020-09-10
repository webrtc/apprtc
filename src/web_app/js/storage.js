/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* exported Storage */

'use strict';

var Storage = function() {};

// Get a value from local browser storage. Calls callback with value.
Storage.prototype.getStorage = function(key, callback) {
  // Use localStorage.
  var value = localStorage.getItem(key);
  if (callback) {
    window.setTimeout(function() {
      callback(value);
    }, 0);
  }
};

// Set a value in local browser storage. Calls callback after completion.
Storage.prototype.setStorage = function(key, value, callback) {
  // Use localStorage.
  localStorage.setItem(key, value);
  if (callback) {
    window.setTimeout(callback, 0);
  }
};
