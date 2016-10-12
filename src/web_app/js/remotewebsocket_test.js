/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals  describe, expect, it, beforeEach, afterEach, Constants,
   FAKE_WSS_URL, apprtc, RemoteWebSocket, MockWindowPort */

'use strict';

describe('RemoteWebSocket Test', function() {
  var TEST_MESSAGE = 'foobar';

  beforeEach(function() {
    this.realWindowPort = apprtc.windowPort;
    apprtc.windowPort = new MockWindowPort();

    this.rws_ = new RemoteWebSocket(FAKE_WSS_URL);
    // Should have an message to request create.
    expect(apprtc.windowPort.messages.length).toEqual(1);
    expect(apprtc.windowPort.messages[0].action).toEqual(Constants.WS_ACTION);
    expect(apprtc.windowPort.messages[0].wsAction)
        .toEqual(Constants.WS_CREATE_ACTION);
    expect(apprtc.windowPort.messages[0].wssUrl).toEqual(FAKE_WSS_URL);
    expect(this.rws_.readyState).toEqual(WebSocket.CONNECTING);
  });

  afterEach(function() {
    apprtc.windowPort = this.realWindowPort;
  });

  it('send before open', function(done) {
    // For some reason toThrow() does not work.
    try {
      this.rws_.send(TEST_MESSAGE);
    } catch (error) {
      done();
    }
  });

  it('send', function() {
    apprtc.windowPort.simulateMessageFromBackground({
      action: Constants.WS_ACTION,
      wsAction: Constants.EVENT_ACTION,
      wsEvent: Constants.WS_EVENT_ONOPEN,
      data: TEST_MESSAGE
    });

    expect(apprtc.windowPort.messages.length).toEqual(1);
    this.rws_.send(TEST_MESSAGE);
    expect(apprtc.windowPort.messages.length).toEqual(2);
    expect(apprtc.windowPort.messages[1].action).toEqual(Constants.WS_ACTION);
    expect(apprtc.windowPort.messages[1].wsAction)
        .toEqual(Constants.WS_SEND_ACTION);
    expect(apprtc.windowPort.messages[1].data).toEqual(TEST_MESSAGE);
  });

  it('close', function(done) {
    this.rws_.onclose = function(message) {
      expect(message).toEqual(TEST_MESSAGE);
      expect(this.readyState).toEqual(WebSocket.CLOSED);
      done();
    };

    expect(apprtc.windowPort.messages.length).toEqual(1);
    this.rws_.close();

    expect(apprtc.windowPort.messages.length).toEqual(2);
    expect(apprtc.windowPort.messages[1].action).toEqual(Constants.WS_ACTION);
    expect(apprtc.windowPort.messages[1].wsAction)
        .toEqual(Constants.WS_CLOSE_ACTION);

    expect(this.rws_.readyState).toEqual(WebSocket.CLOSING);
    apprtc.windowPort.simulateMessageFromBackground({
      action: Constants.WS_ACTION,
      wsAction: Constants.EVENT_ACTION,
      wsEvent: Constants.WS_EVENT_ONCLOSE,
      data: TEST_MESSAGE
    });
  });

  it('onError', function(done) {
    this.rws_.onerror = function(message) {
      expect(message).toEqual(TEST_MESSAGE);
      done();
    };

    apprtc.windowPort.simulateMessageFromBackground({
      action: Constants.WS_ACTION,
      wsAction: Constants.EVENT_ACTION,
      wsEvent: Constants.WS_EVENT_ONERROR,
      data: TEST_MESSAGE
    });
  });

  it('onOpen', function(done) {
    this.rws_.onopen = function() {
      expect(this.readyState).toEqual(WebSocket.OPEN);
      done();
    };

    apprtc.windowPort.simulateMessageFromBackground({
      action: Constants.WS_ACTION,
      wsAction: Constants.EVENT_ACTION,
      wsEvent: Constants.WS_EVENT_ONOPEN,
      data: TEST_MESSAGE
    });
  });

  it('onMessage', function(done) {
    this.rws_.onmessage = function(message) {
      expect(message).toEqual(TEST_MESSAGE);
      done();
    };

    apprtc.windowPort.simulateMessageFromBackground({
      action: Constants.WS_ACTION,
      wsAction: Constants.EVENT_ACTION,
      wsEvent: Constants.WS_EVENT_ONMESSAGE,
      data: TEST_MESSAGE
    });
  });

  it('onSendError', function(done) {
    this.rws_.onsenderror = function(message) {
      expect(message).toEqual(TEST_MESSAGE);
      done();
    };

    apprtc.windowPort.simulateMessageFromBackground({
      action: Constants.WS_ACTION,
      wsAction: Constants.EVENT_ACTION,
      wsEvent: Constants.WS_EVENT_SENDERROR,
      data: TEST_MESSAGE
    });
  });
});
