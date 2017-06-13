/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals AppController, describe, expect, it, beforeEach, afterEach,
   UI_CONSTANTS, $, RoomSelection:true, Call:true */

'use strict';

describe('AppControllerTest', function() {
  var MockCall;
  var MockRoomSelection;
  var roomSelectionBackup_;
  var callBackup_;
  var loadingParams_;
  var mainElem;

  MockRoomSelection = function() {};
  MockRoomSelection.RecentlyUsedList = function() {
    return {
      pushRecentRoom: function() {}
    };
  };
  MockRoomSelection.matchRandomRoomPattern = function() {
    return false;
  };

  MockCall = function() {};
  MockCall.prototype.start = function() {};
  MockCall.prototype.hangup = function() {};

  beforeEach(function(done) {
    roomSelectionBackup_ = RoomSelection;
    RoomSelection = MockRoomSelection;
    callBackup_ = Call;
    Call = MockCall;
    loadingParams_ = {
      mediaConstraints: {
        audio: true, video: true
      }
    };

    // Insert mock DOM elements.
    mainElem = document.createElement('div');
    document.body.insertBefore(mainElem, document.body.firstChild);
    for (var key in UI_CONSTANTS) {
      var elem;
      if (key.toLowerCase().includes('button')) {
        elem = document.createElement('button');
      } else {
        elem = document.createElement('div');
      }
      elem.id = UI_CONSTANTS[key].substr(1);
      mainElem.appendChild(elem);
    }

    loadingParams_.roomId = 'myRoom';
    new AppController(loadingParams_);

    // Needed due to a race where the textContent node is not updated in the div
    //  before testing it.
    $(UI_CONSTANTS.confirmJoinRoomSpan)
        .addEventListener('DOMSubtreeModified', function() {
          done();
        });
  });

  afterEach(function() {
    RoomSelection = roomSelectionBackup_;
    Call = callBackup_;
  });

  it('Confirm to join', function() {
    // Verifies that the confirm-to-join UI is visible and the text matches the
    // room.
    expect($(UI_CONSTANTS.confirmJoinRoomSpan).textContent)
        .toEqual(' "' + loadingParams_.roomId + '"');
    expect($(UI_CONSTANTS.confirmJoinDiv).classList.contains('hidden'))
        .toBeFalsy();
  });

  it('Hide UI after clicking the join button', function(done) {
    // Verifies that the UI is hidden after clicking the button.
    // There seems to be a delay for the beforeEach() to update the DOM tree,
    // need to wait a few seconds before clicking the button as it calls upon
    // a method that adds a 'hidden' class to an element which we then try to
    // find.
    setTimeout(function() {
      $(UI_CONSTANTS.confirmJoinButton).addEventListener('click', function() {
        expect($(UI_CONSTANTS.confirmJoinDiv).classList.contains('hidden'))
            .toBeTruthy();
        done();
      });
      $(UI_CONSTANTS.confirmJoinButton).click();
    }, 2000);
  });
});
