/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

// Variables defined in and used from chrome.
/* globals chrome, sendAsyncUrlRequest, Constants, parseJSON */

'use strict';
(function() {
  chrome.app.runtime.onLaunched.addListener(function() {
    chrome.app.window.create('appwindow.html', {
      'width': 800,
      'height': 600,
      'left': 0,
      'top': 0
    });
  });

  // Send event notification from background to window.
  var sendWSEventMessageToWindow = function(port, wsEvent, data) {
    var message = {
        action: Constants.WS_ACTION,
        wsAction: Constants.EVENT_ACTION,
        wsEvent: wsEvent
    };
    if (data) {
      message.data = data;
    }
    trace('B -> W: ' + JSON.stringify(message));
    try {
      port.postMessage(message);
    } catch (ex) {
      trace('Error sending message: ' + ex);
    }
  };

  var handleWebSocketRequest = function(port, message) {
    if (message.wsAction === Constants.WS_CREATE_ACTION) {
      trace('RWS: creating web socket: ' + message.wssUrl);
      var ws = new WebSocket(message.wssUrl);
      port.wssPostUrl_ = message.wssPostUrl;
      ws.onopen = function() {
        sendWSEventMessageToWindow(port, Constants.WS_EVENT_ONOPEN);
      };
      ws.onerror = function() {
        sendWSEventMessageToWindow(port, Constants.WS_EVENT_ONERROR);
      };
      ws.onclose = function(event) {
        sendWSEventMessageToWindow(port, Constants.WS_EVENT_ONCLOSE, event);
      };
      ws.onmessage = function(event) {
        sendWSEventMessageToWindow(port, Constants.WS_EVENT_ONMESSAGE, event);
      };
      port.webSocket_ = ws;
    } else if (message.wsAction === Constants.WS_SEND_ACTION) {
      trace('RWS: sending: ' + message.data);
      if (port.webSocket_ && port.webSocket_.readyState === WebSocket.OPEN) {
        try {
          port.webSocket_.send(message.data);
        } catch (ex) {
          sendWSEventMessageToWindow(port, Constants.WS_EVENT_SENDERROR, ex);
        }
      } else {
        // Attempt to send message using wss port url.
        trace('RWS: web socket not ready, falling back to POST.');
        var msg = parseJSON(message.data);
        if (msg) {
          sendAsyncUrlRequest('POST', port.wssPostUrl_, msg.msg);
        }
      }
    } else if (message.wsAction === Constants.WS_CLOSE_ACTION) {
      trace('RWS: close');
      if (port.webSocket_) {
        port.webSocket_.close();
        port.webSocket = null;
      }
    }
  };

  var executeCleanupTask = function(port, message) {
    trace('Executing queue action: ' + JSON.stringify(message));
    if (message.action === Constants.XHR_ACTION) {
      var method = message.method;
      var url = message.url;
      var body = message.body;
      return sendAsyncUrlRequest(method, url, body);
    } else if (message.action === Constants.WS_ACTION) {
      handleWebSocketRequest(port, message);
    } else {
      trace('Unknown action in cleanup queue: ' + message.action);
    }
  };

  var executeCleanupTasks = function(port, queue) {
    var promise = Promise.resolve();
    if (!queue) {
      return promise;
    }

    var catchFunction = function(error) {
      trace('Error executing cleanup action: ' + error.message);
    };

    while (queue.length > 0) {
      var queueMessage = queue.shift();
      promise = promise.then(
          executeCleanupTask.bind(null, port, queueMessage)
      ).catch(catchFunction);
    }
    return promise;
  };

  var handleMessageFromWindow = function(port, message) {
    var action = message.action;
    if (action === Constants.WS_ACTION) {
      handleWebSocketRequest(port, message);
    } else if (action === Constants.QUEUECLEAR_ACTION) {
      port.queue_ = [];
    } else if (action === Constants.QUEUEADD_ACTION) {
      if (!port.queue_) {
        port.queue_ = [];
      }
      port.queue_.push(message.queueMessage);
    } else {
      trace('Unknown action from window: ' + action);
    }
  };

  chrome.runtime.onConnect.addListener(function(port) {
    port.onDisconnect.addListener(function() {
      // Execute the cleanup queue.
      executeCleanupTasks(port, port.queue_).then(function() {
        // Close web socket.
        if (port.webSocket_) {
          trace('Closing web socket.');
          port.webSocket_.close();
          port.webSocket_ = null;
        }
      });
    });

    port.onMessage.addListener(function(message) {
      // Handle message from window to background.
      trace('W -> B: ' + JSON.stringify(message));
      handleMessageFromWindow(port, message);
    });
  });
})();
