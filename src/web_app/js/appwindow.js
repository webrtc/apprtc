/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
// Variables defined in and used from main.js.
/* globals randomString, AppController, sendAsyncUrlRequest, parseJSON */
/* exported params */
'use strict';

// Generate random room id and connect.
var roomServer = 'https://appr.tc';
var loadingParams = {
  errorMessages: [],
  warningMessages: [],
  suggestedRoomId: randomString(9),
  roomServer: roomServer,
  connect: false,
  paramsFunction: function() {
    return new Promise(function(resolve, reject) {
      trace('Initializing; retrieving params from: ' + roomServer + '/params');
      sendAsyncUrlRequest('GET', roomServer + '/params').then(function(result) {
        var serverParams = parseJSON(result);
        var newParams = {};
        if (!serverParams) {
          resolve(newParams);
          return;
        }

        // Convert from server format to expected format.
        newParams.isLoopback = serverParams.is_loopback === 'true';
        newParams.mediaConstraints = parseJSON(serverParams.media_constraints);
        newParams.offerOptions = parseJSON(serverParams.offer_options);
        newParams.peerConnectionConfig = parseJSON(serverParams.pc_config);
        newParams.peerConnectionConstraints =
            parseJSON(serverParams.pc_constraints);
        newParams.iceServerRequestUrl = serverParams.ice_server_url;
        newParams.iceServerTransports = serverParams.ice_server_transports;
        newParams.wssUrl = serverParams.wss_url;
        newParams.wssPostUrl = serverParams.wss_post_url;
        newParams.versionInfo = parseJSON(serverParams.version_info);
        newParams.messages = serverParams.messages;

        trace('Initializing; parameters from server: ');
        trace(JSON.stringify(newParams));
        resolve(newParams);
      }).catch(function(error) {
        trace('Initializing; error getting params from server: ' +
            error.message);
        reject(error);
      });
    });
  }
};

new AppController(loadingParams);
