/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* exported setupLoopback */

'use strict';

// We handle the loopback case by making a second connection to the WSS so that
// we receive the same messages that we send out. When receiving an offer we
// convert that offer into an answer message. When receiving candidates we
// echo back the candidate. Answer is ignored because we should never receive
// one while in loopback. Bye is ignored because there is no work to do.
var loopbackWebSocket = null;
var LOOPBACK_CLIENT_ID = 'loopback_client_id';
function setupLoopback(wssUrl, roomId) {
  if (loopbackWebSocket) {
    loopbackWebSocket.close();
  }
  trace('Setting up loopback WebSocket.');
  // TODO(tkchin): merge duplicate code once SignalingChannel abstraction
  // exists.
  loopbackWebSocket = new WebSocket(wssUrl);

  var sendLoopbackMessage = function(message) {
    var msgString = JSON.stringify({
      cmd: 'send',
      msg: JSON.stringify(message)
    });
    loopbackWebSocket.send(msgString);
  };

  loopbackWebSocket.onopen = function() {
    trace('Loopback WebSocket opened.');
    var registerMessage = {
      cmd: 'register',
      roomid: roomId,
      clientid: LOOPBACK_CLIENT_ID
    };
    loopbackWebSocket.send(JSON.stringify(registerMessage));
  };

  loopbackWebSocket.onmessage = function(event) {
    var wssMessage;
    var message;
    try {
      wssMessage = JSON.parse(event.data);
      message = JSON.parse(wssMessage.msg);
    } catch (e) {
      trace('Error parsing JSON: ' + event.data);
      return;
    }
    if (wssMessage.error) {
      trace('WSS error: ' + wssMessage.error);
      return;
    }
    if (message.type === 'offer') {
      var loopbackAnswer = wssMessage.msg;
      loopbackAnswer = loopbackAnswer.replace('"offer"', '"answer"');
      loopbackAnswer =
          loopbackAnswer.replace('a=ice-options:google-ice\\r\\n', '');
      // As of Chrome M51, an additional crypto method has been added when
      // using SDES. This works in a P2P due to the negotiation phase removes
      // this line but for loopback where we reuse the offer, that is skipped
      // and remains in the answer and breaks the call.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=616263
      loopbackAnswer = loopbackAnswer
          .replace(/a=crypto:0 AES_CM_128_HMAC_SHA1_32\sinline:.{44}/, '');
      sendLoopbackMessage(JSON.parse(loopbackAnswer));
    } else if (message.type === 'candidate') {
      sendLoopbackMessage(message);
    }
  };

  loopbackWebSocket.onclose = function(event) {
    trace('Loopback WebSocket closed with code:' + event.code + ' reason:' +
          event.reason);
  };
}
