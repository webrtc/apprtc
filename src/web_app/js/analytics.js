/*
 * Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that
 * can be found in the LICENSE file in the root of the source tree.
 */

/* globals sendAsyncUrlRequest, enums, JSON */

'use strict';

/*
 * The analytics object is used to send up client-side logging
 * information.
 * @param {string} URL to the room server.
 * @constructor
 */
var Analytics = function(roomServer) {
  /* @private {String} Room server URL. */
  this.analyticsPath_ = roomServer + '/a/';
};

// Disable check here due to jscs not recognizing the types below.
/* jscs: disable */
/**
 * Defines a type for our event objects.
 * @typedef {
 *   enums.RequestField.EventField.EVENT_TYPE: enums.EventType,
 *   enums.RequestField.EventField.ROOM_ID: ?string,
 *   enums.RequestField.EventField.FLOWN_ID: ?number,
 *   enums.RequestField.EventField.EVENT_TIME_MS: number
 * }
 * @private
 */
/* jscs: enable */
Analytics.EventObject_ = {};

/**
 * Report an event.
 *
 * @param {enums.EventType} eventType The event string to record.
 * @param {String=} roomId The current room ID.
 * @param {Number=} flowId The current room ID.
 */
Analytics.prototype.reportEvent = function(eventType, roomId, flowId) {
  var eventObj = {};
  eventObj[enums.RequestField.EventField.EVENT_TYPE] = eventType;
  eventObj[enums.RequestField.EventField.EVENT_TIME_MS] = Date.now();

  if (roomId) {
    eventObj[enums.RequestField.EventField.ROOM_ID] = roomId;
  }
  if (flowId) {
    eventObj[enums.RequestField.EventField.FLOW_ID] = flowId;
  }
  this.sendEventRequest_(eventObj);
};

/**
 * Send an event object to the server.
 *
 * @param {Analytics.EventObject_} eventObj Event object to send.
 * @private
 */
Analytics.prototype.sendEventRequest_ = function(eventObj) {
  var request = {};
  request[enums.RequestField.TYPE] = enums.RequestField.MessageType.EVENT;
  request[enums.RequestField.REQUEST_TIME_MS] = Date.now();
  request[enums.RequestField.EVENT] = eventObj;

  sendAsyncUrlRequest('POST', this.analyticsPath_,
      JSON.stringify(request))
      .then(function() {}.bind(this), function(error) {
        trace('Failed to send event request: ' + error.message);
      }.bind(this));
};
