/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals trace, chrome */
/* exported apprtc, apprtc.windowPort */

'use strict';

// This is used to communicate from the Chrome App window to background.js.
// It opens a Port object to send and receive messages. When the Chrome
// App window is closed, background.js receives notification and can
// handle clean up tasks.
var apprtc = apprtc || {};
apprtc.windowPort = apprtc.windowPort || {};
(function() {
  var port_;

  apprtc.windowPort.sendMessage = function(message) {
    var port = getPort_();
    try {
      port.postMessage(message);
    } catch (ex) {
      trace('Error sending message via port: ' + ex);
    }
  };

  apprtc.windowPort.addMessageListener = function(listener) {
    var port = getPort_();
    port.onMessage.addListener(listener);
  };

  var getPort_ = function() {
    if (!port_) {
      port_ = chrome.runtime.connect();
    }
    return port_;
  };
})();
