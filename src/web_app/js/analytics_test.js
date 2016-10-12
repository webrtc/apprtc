/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals Analytics, describe, expect, it, beforeEach, afterEach,
   sendAsyncUrlRequest:true, Mock, enums */

'use strict';

describe('AnalyticsTest', function() {
  var url;
  var analytics;
  var eventTime;
  var eventType;
  var realDateNow;
  var realSendAsyncRequest;

  beforeEach(function() {
    url = 'https://test.org';
    analytics = new Analytics(url);
    eventType = enums.EventType.ROOM_SIZE_2;
    eventTime = 1234;
    realDateNow = Date.now;
    // Mock global calls.
    realSendAsyncRequest = sendAsyncUrlRequest;
    sendAsyncUrlRequest = Mock.createSendAsyncUrlRequestMock();
    Date.now = function() {
      return eventTime;
    };
  });

  afterEach(function() {
    sendAsyncUrlRequest = realSendAsyncRequest;
    Date.now = realDateNow;
  });

  it('Report with all fields', function() {
    var roomId = 'my awesome room';
    var flowId = 24;
    // Test reportEvent with all optional arguments.
    analytics.reportEvent(eventType, roomId, flowId);

    // Verify xhr request.
    expect(sendAsyncUrlRequest.calls().length).toEqual(1);
    var call = sendAsyncUrlRequest.calls()[0];
    expect(call.method).toEqual('POST');
    expect(call.url.indexOf(url) === 0).toBeTruthy();

    var actualRequest = JSON.parse(call.body);
    expect(actualRequest[enums.RequestField.TYPE])
        .toEqual(enums.RequestField.MessageType.EVENT);
    expect(actualRequest[enums.RequestField.REQUEST_TIME_MS])
        .toEqual(eventTime);

    var actualEvent = actualRequest[enums.RequestField.EVENT];
    expect(actualEvent[enums.RequestField.EventField.EVENT_TYPE])
        .toEqual(eventType);
    expect(actualEvent[enums.RequestField.EventField.EVENT_TIME_MS])
        .toEqual(eventTime);
    expect(actualEvent[enums.RequestField.EventField.ROOM_ID]).toEqual(roomId);
    expect(actualEvent[enums.RequestField.EventField.FLOW_ID]).toEqual(flowId);
  });

  it('Report without any optional fields', function() {
    // Test reportEvent with all optional arguments.
    analytics.reportEvent(eventType);

    // Verify xhr request.
    expect(sendAsyncUrlRequest.calls().length).toEqual(1);
    var call = sendAsyncUrlRequest.calls()[0];
    expect(call.method).toEqual('POST');
    expect(call.url.indexOf(url) === 0).toBeTruthy();

    var actualRequest = JSON.parse(call.body);
    expect(actualRequest[enums.RequestField.TYPE])
        .toEqual(enums.RequestField.MessageType.EVENT);
    expect(actualRequest[enums.RequestField.REQUEST_TIME_MS])
        .toEqual(eventTime);

    var actualEvent = actualRequest[enums.RequestField.EVENT];
    expect(actualEvent[enums.RequestField.EventField.EVENT_TYPE])
        .toEqual(eventType);
    expect(actualEvent[enums.RequestField.EventField.EVENT_TIME_MS])
        .toEqual(eventTime);
    expect(actualEvent[enums.RequestField.EventField.ROOM_ID])
        .toEqual(undefined);
    expect(actualEvent[enums.RequestField.EventField.FLOW_ID])
        .toEqual(undefined);
  });
});

