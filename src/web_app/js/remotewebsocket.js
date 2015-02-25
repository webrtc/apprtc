/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals apprtc, Constants */
/* exported RemoteWebSocket */

'use strict';

// This class is used as a proxy for the WebSocket owned by background.js.
// This proxy class sends commands and receives events via a Port object
// opened to communicate with background.js in a Chrome App.
// The WebSocket object must be owned by background.js so the call can be
// properly terminated when the app window is closed.
var RemoteWebSocket = function(wssUrl, wssPostUrl) {
  this.wssUrl_ = wssUrl;
  apprtc.windowPort.addMessageListener(this.handleMessage_.bind(this));
  this.sendMessage_({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_CREATE_ACTION,
    wssUrl: wssUrl,
    wssPostUrl: wssPostUrl
  });
  this.readyState = WebSocket.CONNECTING;
};

RemoteWebSocket.prototype.sendMessage_ = function(message) {
  apprtc.windowPort.sendMessage(message);
};

RemoteWebSocket.prototype.send = function(data) {
  if (this.readyState !== WebSocket.OPEN) {
    throw 'Web socket is not in OPEN state: ' + this.readyState;
  }
  this.sendMessage_({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_SEND_ACTION,
    data: data
  });
};

RemoteWebSocket.prototype.close = function() {
  if (this.readyState === WebSocket.CLOSING ||
      this.readyState === WebSocket.CLOSED) {
    return;
  }
  this.readyState = WebSocket.CLOSING;
  this.sendMessage_({
    action: Constants.WS_ACTION,
    wsAction: Constants.WS_CLOSE_ACTION
  });
};

RemoteWebSocket.prototype.handleMessage_ = function(message) {
  if (message.action === Constants.WS_ACTION &&
        message.wsAction === Constants.EVENT_ACTION) {
    if (message.wsEvent === Constants.WS_EVENT_ONOPEN) {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen();
      }
    } else if (message.wsEvent === Constants.WS_EVENT_ONCLOSE) {
      this.readyState = WebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(message.data);
      }
    } else if (message.wsEvent === Constants.WS_EVENT_ONERROR) {
      if (this.onerror) {
        this.onerror(message.data);
      }
    } else if (message.wsEvent === Constants.WS_EVENT_ONMESSAGE) {
      if (this.onmessage) {
        this.onmessage(message.data);
      }
    } else if (message.wsEvent === Constants.WS_EVENT_SENDERROR) {
      if (this.onsenderror) {
        this.onsenderror(message.data);
      }
      trace('ERROR: web socket send failed: ' + message.data);
    }
  }
};
