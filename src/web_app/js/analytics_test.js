/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals Analytics, TestCase, assertEquals,
   sendAsyncUrlRequest:true, Mock, assertTrue, enums */

'use strict';

var AnalyticsTest = new TestCase('AnalyticsTest');

AnalyticsTest.prototype.setUp = function() {
};

AnalyticsTest.prototype.tearDown = function() {
};

/** Test sending a report with all fields. */
AnalyticsTest.prototype.testReportEventAll = function() {
  var url = 'https://test.org';
  var analytics = new Analytics(url);

  var eventType = enums.EventType.ROOM_SIZE_2;
  var eventTime = 1234;
  var roomId = 'my awesome room';
  var flowId = 24;

  // Mock global calls.
  var realSendAsyncRequest = sendAsyncUrlRequest;
  sendAsyncUrlRequest = Mock.createSendAsyncUrlRequestMock();

  var realDateNow = Date.now;
  Date.now = function() {
    return eventTime;
  };

  // Test reportEvent with all optional arguments.
  analytics.reportEvent(eventType, roomId, flowId);

  // Verify xhr request.
  assertEquals(1, sendAsyncUrlRequest.calls().length);
  var call = sendAsyncUrlRequest.calls()[0];
  assertEquals('POST', call.method);
  assertTrue(call.url.indexOf(url) === 0);

  var actualRequest = JSON.parse(call.body);
  assertEquals(enums.RequestField.MessageType.EVENT,
      actualRequest[enums.RequestField.TYPE]);
  assertEquals(eventTime, actualRequest[enums.RequestField.REQUEST_TIME_MS]);

  var actualEvent = actualRequest[enums.RequestField.EVENT];
  assertEquals(eventType,
      actualEvent[enums.RequestField.EventField.EVENT_TYPE]);
  assertEquals(eventTime,
      actualEvent[enums.RequestField.EventField.EVENT_TIME_MS]);
  assertEquals(roomId, actualEvent[enums.RequestField.EventField.ROOM_ID]);
  assertEquals(flowId, actualEvent[enums.RequestField.EventField.FLOW_ID]);

  sendAsyncUrlRequest = realSendAsyncRequest;
  Date.now = realDateNow;
};

/** Test sending a report without any optional fields. */
AnalyticsTest.prototype.testReportEventWithoutOptional = function() {
  var url = 'https://test.org';
  var analytics = new Analytics(url);

  var eventType = enums.EventType.ROOM_SIZE_2;
  var eventTime = 1234;

  // Mock global calls.
  var realSendAsyncRequest = sendAsyncUrlRequest;
  sendAsyncUrlRequest = Mock.createSendAsyncUrlRequestMock();

  var realDateNow = Date.now;
  Date.now = function() {
    return eventTime;
  };

  // Test reportEvent with all optional arguments.
  analytics.reportEvent(eventType);

  // Verify xhr request.
  assertEquals(1, sendAsyncUrlRequest.calls().length);
  var call = sendAsyncUrlRequest.calls()[0];
  assertEquals('POST', call.method);
  assertTrue(call.url.indexOf(url) === 0);

  var actualRequest = JSON.parse(call.body);
  assertEquals(enums.RequestField.MessageType.EVENT,
      actualRequest[enums.RequestField.TYPE]);
  assertEquals(eventTime, actualRequest[enums.RequestField.REQUEST_TIME_MS]);

  var actualEvent = actualRequest[enums.RequestField.EVENT];
  assertEquals(eventType,
      actualEvent[enums.RequestField.EventField.EVENT_TYPE]);
  assertEquals(eventTime,
      actualEvent[enums.RequestField.EventField.EVENT_TIME_MS]);
  assertEquals(undefined, actualEvent[enums.RequestField.EventField.ROOM_ID]);
  assertEquals(undefined, actualEvent[enums.RequestField.EventField.FLOW_ID]);

  sendAsyncUrlRequest = realSendAsyncRequest;
  Date.now = realDateNow;
};
