/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* exported calculateFps, setUpFullScreen, fullScreenElement, isFullScreen,
   requestIceServers, sendAsyncUrlRequest, sendSyncUrlRequest,
   randomString, trace, $, queryStringToDictionary */
/* globals chrome */

'use strict';

function $(selector) {
  return document.querySelector(selector);
}

// Returns the URL query key-value pairs as a dictionary object.
function queryStringToDictionary(queryString) {
  var pairs = queryString.slice(1).split('&');

  var result = {};
  pairs.forEach(function(pair) {
    if (pair) {
      pair = pair.split('=');
      if (pair[0]) {
        result[pair[0]] = decodeURIComponent(pair[1] || '');
      }
    }
  });
  return result;
}

// Sends the URL request and returns a Promise as the result.
function sendAsyncUrlRequest(method, url, body) {
  return sendUrlRequest(method, url, true, body);
}

// If async is true, returns a Promise and executes the xhr request
// async. If async is false, the xhr will be executed sync and a
// resolved promise is returned.
function sendUrlRequest(method, url, async, body) {
  return new Promise(function(resolve, reject) {
    var xhr;
    var reportResults = function() {
      if (xhr.status !== 200) {
        reject(
            Error('Status=' + xhr.status + ', response=' +
                  xhr.responseText));
        return;
      }
      resolve(xhr.responseText);
    };

    xhr = new XMLHttpRequest();
    if (async) {
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) {
          return;
        }
        reportResults();
      };
    }
    xhr.open(method, url, async);
    xhr.send(body);

    if (!async) {
      reportResults();
    }
  });
}

// Returns a list of ICE servers after requesting it from the ICE server
// provider.
// Example response (iceServerRequestResponse) from the ICE server provider
// containing two TURN servers and one STUN server:
// {
//   lifetimeDuration: '43200.000s',
//   iceServers: [
//     {
//       urls: ['turn:1.2.3.4:19305', 'turn:1.2.3.5:19305'],
//       username: 'username',
//       credential: 'credential'
//     },
//     {
//       urls: ['stun:stun.example.com:19302']
//     }
//   ]
// }
function requestIceServers(iceServerRequestUrl, iceTransports) {
  return new Promise(function(resolve, reject) {
    sendAsyncUrlRequest('POST', iceServerRequestUrl).then(function(response) {
      var iceServerRequestResponse = parseJSON(response);
      if (!iceServerRequestResponse) {
        reject(Error('Error parsing response JSON: ' + response));
        return;
      }
      if (iceTransports !== '') {
        filterIceServersUrls(iceServerRequestResponse, iceTransports);
      }
      trace('Retrieved ICE server information.');
      resolve(iceServerRequestResponse.iceServers);
    }).catch(function(error) {
      reject(Error('ICE server request error: ' + error.message));
      return;
    });
  });
}

// Parse the supplied JSON, or return null if parsing fails.
function parseJSON(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    trace('Error parsing json: ' + json);
  }
  return null;
}

// Filter a peerConnection config to only contain ice servers with
// transport=|protocol|.
function filterIceServersUrls(config, protocol) {
  var transport = 'transport=' + protocol;
  var newIceServers = [];
  for (var i = 0; i < config.iceServers.length; ++i) {
    var iceServer = config.iceServers[i];
    var newUrls = [];
    for (var j = 0; j < iceServer.urls.length; ++j) {
      var url = iceServer.urls[j];
      if (url.indexOf(transport) !== -1) {
        newUrls.push(url);
      } else if (
        url.indexOf('?transport=') === -1) {
        newUrls.push(url + '?' + transport);
      }
    }
    if (newUrls.length !== 0) {
      iceServer.urls = newUrls;
      newIceServers.push(iceServer);
    }
  }
  config.iceServers = newIceServers;
}

// Start shims for fullscreen
function setUpFullScreen() {
  if (isChromeApp()) {
    document.cancelFullScreen = function() {
      chrome.app.window.current().restore();
    };
  } else {
    document.cancelFullScreen = document.webkitCancelFullScreen ||
        document.mozCancelFullScreen || document.cancelFullScreen;
  }

  if (isChromeApp()) {
    document.body.requestFullScreen = function() {
      chrome.app.window.current().fullscreen();
    };
  } else {
    document.body.requestFullScreen = document.body.webkitRequestFullScreen ||
        document.body.mozRequestFullScreen || document.body.requestFullScreen;
  }

  document.onfullscreenchange = document.onfullscreenchange ||
        document.onwebkitfullscreenchange || document.onmozfullscreenchange;
}

function isFullScreen() {
  if (isChromeApp()) {
    return chrome.app.window.current().isFullscreen();
  }

  return !!(document.webkitIsFullScreen || document.mozFullScreen ||
    document.isFullScreen); // if any defined and true
}

function fullScreenElement() {
  return document.webkitFullScreenElement ||
      document.webkitCurrentFullScreenElement ||
      document.mozFullScreenElement ||
      document.fullScreenElement;
}

// End shims for fullscreen

// Return a random numerical string.
function randomString(strLength) {
  var result = [];
  strLength = strLength || 5;
  var charSet = '0123456789';
  while (strLength--) {
    result.push(charSet.charAt(Math.floor(Math.random() * charSet.length)));
  }
  return result.join('');
}

// Returns true if the code is running in a packaged Chrome App.
function isChromeApp() {
  return (typeof chrome !== 'undefined' &&
          typeof chrome.storage !== 'undefined' &&
          typeof chrome.storage.local !== 'undefined');
}

// Calculcates FPS for the provided video elements and calls on a callback which
// is used to update the necessary stats for either remote or local videos.
// Adapted from https://cs.chromium.org/chromium/src/chrome/test/data/media/html/media_stat_perf.html
function calculateFps(videoElement, decodedFrames, startTime, remoteOrLocal,
  callback) {
  var fps = 0;
  if (videoElement &&
      typeof videoElement.webkitDecodedFrameCount !== undefined) {
    if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
      var currentTime = new Date().getTime();
      var deltaTime = (currentTime - startTime) / 1000;
      var startTimeToReturn = currentTime;
      fps = (videoElement.webkitDecodedFrameCount - decodedFrames) / deltaTime;
      callback(videoElement.webkitDecodedFrameCount, startTimeToReturn,
          remoteOrLocal);
    }
  }
  return parseInt(fps);
}

function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}
