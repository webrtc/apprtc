/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals describe, expect, it, beforeEach, afterEach,UI_CONSTANTS,
   RoomSelection */

'use strict';

describe('Room selection Test', function() {
  var createUIEvent = function(type) {
    var event = new UIEvent(type);
    return event;
  };

  beforeEach(function() {
    this.key_ = 'testRecentRoomsKey';
    localStorage.removeItem(this.key_);
    localStorage.setItem(this.key_, '["room1", "room2", "room3"]');
    this.fullList_ =
        '["room4","room5","room6","room7","room8","room9",' +
        '"room10","room11","room12","room13"]';
    this.tooManyList_ =
        '["room1","room2","room3","room4","room5","room6",' +
        '"room7","room8","room9","room10","room11","room12","room13"]';
    this.duplicatesList_ =
        '["room4","room4","room6","room7","room6","room9",' +
        '"room10","room4","room6","room13"]';
    this.noDuplicatesList_ =
        '["room4","room6","room7","room9","room10","room13"]';
    this.emptyList_ = '[]';
    this.notAList_ = 'asdasd';

    this.recentlyUsedList_ = new RoomSelection.RecentlyUsedList(this.key_);

    this.targetDiv_ = document.createElement('div');
    this.targetDiv_.id = UI_CONSTANTS.roomSelectionDiv.substring(1);

    this.inputBox_ = document.createElement('input');
    this.inputBox_.id = UI_CONSTANTS.roomSelectionInput.substring(1);
    this.inputBox_.type = 'text';

    this.inputBoxLabel_ = document.createElement('label');
    this.inputBoxLabel_.id = UI_CONSTANTS.roomSelectionInputLabel.substring(1);

    this.randomButton_ = document.createElement('button');
    this.randomButton_.id = UI_CONSTANTS.roomSelectionRandomButton.substring(1);

    this.joinButton_ = document.createElement('button');
    this.joinButton_.id = UI_CONSTANTS.roomSelectionJoinButton.substring(1);

    this.recentList_ = document.createElement('ul');
    this.recentList_.id = UI_CONSTANTS.roomSelectionRecentList.substring(1);

    this.targetDiv_.appendChild(this.inputBox_);
    this.targetDiv_.appendChild(this.inputBoxLabel_);
    this.targetDiv_.appendChild(this.randomButton_);
    this.targetDiv_.appendChild(this.joinButton_);
    this.targetDiv_.appendChild(this.recentList_);

    this.roomSelectionSetupCompletedPromise_ = new Promise(function(resolve) {
      this.roomSelection_ = new RoomSelection(this.targetDiv_, UI_CONSTANTS,
          this.key_, function() {
            resolve();
          }.bind(this));
    }.bind(this));
  });

  afterEach(function() {
    localStorage.removeItem(this.key_);
    this.roomSelection_ = null;
  });

  it('input filter', function() {
    var validInputs = [
      '123123',
      'asdfs3',
      'room1',
      '3254234523452345234523452345asdfasfdasdf'
    ];
    var invalidInputs = [
      '',
      ' ',
      'abcd',
      '123',
      '[5afasdf',
      'ñsaer3'
    ];

    var testInput = function(input, expectedResult) {
      this.inputBox_.value = input;
      this.inputBox_.dispatchEvent(createUIEvent('input'));
      expect(this.joinButton_.disabled).toEqual(expectedResult);
    }.bind(this);

    for (var i = 0; i < validInputs.length; ++i) {
      testInput(validInputs[i], false);
    }

    for (i = 0; i < invalidInputs.length; ++i) {
      testInput(invalidInputs[i], true);
    }
  });

  it('random button', function() {
    this.inputBox_.value = '123';
    this.randomButton_.click();
    expect(this.inputBox_.value).toMatch(/[0-9]{9}/);
  });

  it('recent list has children', function(done) {
    this.roomSelectionSetupCompletedPromise_.then(function() {
      var children = this.recentList_.children;
      expect(children.length).toEqual(3);
      expect(children[0].innerText).toEqual('room1');
      expect(children[0].children.length).toEqual(1);
      expect(children[0].children[0].href).toMatch(/room1/);
      done();
    }.bind(this));
  });

  it('test join button', function() {
    this.inputBox_.value = 'targetRoom';
    var joinedRoom = null;
    this.roomSelection_.onRoomSelected = function(room) {
      joinedRoom = room;
    };
    this.joinButton_.click();

    expect(joinedRoom).toEqual('targetRoom');
  });

  it('make click handler', function(done) {
    this.roomSelectionSetupCompletedPromise_.then(function() {
      var children = this.recentList_.children;
      var link = children[0].children[0];

      var joinedRoom = null;
      this.roomSelection_.onRoomSelected = function(room) {
        joinedRoom = room;
      };
      link.dispatchEvent(createUIEvent('click'));
      expect(joinedRoom).toEqual('room1');
      done();
    }.bind(this));
  });

  it('match random room pattern', function() {
    var testCases = [
      'abcdefghi',
      '1abcdefgh',
      '1abcdefg1',
      '12345678',
      '12345678a',
      'a12345678',
      '123456789'
    ];
    var expected = [
      false, false, false, false, false, false, true
    ];
    for (var i = 0; i < testCases.length; ++i) {
      expect(RoomSelection.matchRandomRoomPattern(testCases[i]))
          .toEqual(expected[i]);
    }
  });

  it('hit enter in room id input', function() {
    var joinedRoom = null;
    this.roomSelection_.onRoomSelected = function(room) {
      joinedRoom = room;
    };
    function createEnterKeyUpEvent() {
      var e = new Event('keyup');
      e.keyCode = 13;
      e.which = 13;
      return e;
    }

    // Hitting ENTER when the room name is invalid should do nothing.
    this.inputBox_.value = '1';
    this.inputBox_.dispatchEvent(createUIEvent('input'));
    this.inputBox_.dispatchEvent(createEnterKeyUpEvent());
    expect(joinedRoom).toBeNull();

    // Hitting ENTER when the room name is valid should select the room.
    this.inputBox_.value = '12345';
    this.inputBox_.dispatchEvent(createUIEvent('input'));
    expect(this.joinButton_.disabled).toBeFalsy();
    this.inputBox_.dispatchEvent(createEnterKeyUpEvent());
    expect(joinedRoom).toEqual(this.inputBox_.value);

    joinedRoom = null;
    // Hitting other keys should not select the room.
    var e = new Event('keyup');
    e.initEvent('keyup', true, true);
    this.inputBox_.dispatchEvent(e);
    expect(joinedRoom).toBeNull();
  });

  it('recently used list', function(done) {
    localStorage.removeItem(this.key_);
    localStorage.setItem(this.key_, this.duplicatesList_);
    this.recentlyUsedList_.pushRecentRoom('newRoom').then(function() {
      var result = localStorage.getItem(this.key_);
      expect(result).toEqual(this.noDuplicatesList_.replace('"room4"',
          '"newRoom","room4"'));
      done();
    }.bind(this));
  });

  it('push recently used room too many list', function(done) {
    localStorage.removeItem(this.key_);
    localStorage.setItem(this.key_, this.tooManyList_);
    this.recentlyUsedList_.pushRecentRoom('newRoom').then(function() {
      var result = localStorage.getItem(this.key_);
      expect(result).toEqual(this.tooManyList_
          .replace(',"room10","room11","room12","room13"', '')
          .replace('"room1"', '"newRoom","room1"'));
      done();
    }.bind(this));
  });

  it('push recently used room full list', function(done) {
    localStorage.removeItem(this.key_);
    localStorage.setItem(this.key_, this.fullList_);
    this.recentlyUsedList_.pushRecentRoom('newRoom').then(function() {
      var result = localStorage.getItem(this.key_);
      expect(result).toEqual(this.fullList_
          .replace(',"room13"', '').replace('"room4"', '"newRoom","room4"'));
      done();
    }.bind(this));
  });

  it('push recently used room no existing', function(done) {
    localStorage.removeItem(this.key_);
    this.recentlyUsedList_.pushRecentRoom('newRoom').then(function() {
      var result = localStorage.getItem(this.key_);
      expect(result).toEqual('["newRoom"]');
      done();
    }.bind(this));
  });

  it('push recently used room invalid existing', function(done) {
    localStorage.removeItem(this.key_);
    localStorage.setItem(this.key_, this.notAList_);
    this.recentlyUsedList_.pushRecentRoom('newRoom').then(function() {
      var result = localStorage.getItem(this.key_);
      expect(result).toEqual('["newRoom"]');
      done();
    }.bind(this));
  });
});
