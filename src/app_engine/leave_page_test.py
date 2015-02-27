# Copyright 2015 Google Inc. All Rights Reserved.

import unittest

import constants
import room
import test_utilities


class LeavePageHandlerTest(test_utilities.BasePageHandlerTest):
  def testLeaveInvalidInput(self):
    body = {
        constants.PARAM_USER_GCM_ID: 'callee1gcm1'
    }
    self.checkInvalidRequestsJsonResult('/leave/room1', body.keys())

  def testLeaveNoRoom(self):
    self.addTestData()
    room_id = 'callercallee'

    self.requestLeaveAndVerify(room_id, 'caller1gcm1',
                               constants.RESPONSE_INVALID_ROOM)

  def testLeaveInvalidUser(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)

    self.requestLeaveAndVerify(room_id, 'caller1gcm2',
                               constants.RESPONSE_INVALID_USER)
    self.requestLeaveAndVerify(room_id, 'caller2gcm1',
                               constants.RESPONSE_INVALID_USER)

  def testLeaveUserNotInRoom(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    # Call /leave as a user who is on the allowed list but not
    # actually in the room.
    self.requestLeaveAndVerify(room_id, 'callee1gcm1',
                               constants.RESPONSE_INVALID_USER,
                               '/leave should fail as callee not yet joined.')
    # Join the room.
    self.requestAcceptAndVerify(room_id, 'callee1gcm1',
                                constants.RESPONSE_SUCCESS)
    # Call /leave with another of the callee's gcm ids, that isn't
    # in the room.
    self.requestLeaveAndVerify(room_id, 'callee1gcm2',
                               constants.RESPONSE_INVALID_USER,
                               '/leave should fail for callee\'s gcm id not'
                               ' in the room.')

  def testLeaveOneUser(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)

    self.requestLeaveAndVerify(room_id, 'caller1gcm1',
                               constants.RESPONSE_SUCCESS)
    self.assertEqual(room.Room.STATE_EMPTY,
                     room.get_room_state(self.HOST, room_id))

  def testLeaveFullRoomAsCaller(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    # Accept the room so it is full.
    self.requestAcceptAndVerify(room_id, 'callee1gcm1',
                                constants.RESPONSE_SUCCESS)
    self.requestLeaveAndVerify(room_id, 'caller1gcm1',
                               constants.RESPONSE_SUCCESS)
    self.assertEqual(room.Room.STATE_EMPTY,
                     room.get_room_state(self.HOST, room_id))

  def testLeaveFullRoomAsCallee(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    # Accept the room so it is full.
    self.requestAcceptAndVerify(room_id, 'callee1gcm1',
                                constants.RESPONSE_SUCCESS)
    self.requestLeaveAndVerify(room_id, 'callee1gcm1',
                               constants.RESPONSE_SUCCESS)
    self.assertEqual(room.Room.STATE_EMPTY,
                     room.get_room_state(self.HOST, room_id))

  def testLeaveInvalidRoomType(self):
    self.addTestData()
    # Room created by apprtc.
    room_id = 'room2'
    response = self.makePostRequest('/join/' + room_id)
    self.verifyResultCode(response, constants.RESPONSE_SUCCESS)
    # Attempt /leave with body, can only operate on direct call rooms.
    self.requestLeaveAndVerify(room_id, 'caller1gcm1',
                               constants.RESPONSE_INVALID_ROOM)

    # Room created by direct call.
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    self.requestAcceptAndVerify(room_id, 'callee1gcm1',
                                constants.RESPONSE_SUCCESS)
    self.assertEqual(room.Room.STATE_FULL,
                     room.get_room_state(self.HOST, room_id),
                     'Room should be full after accept')
    # Attempt /leave without body, can only operate on open rooms.
    response = self.makePostRequest('/leave/' + room_id + '/' + 'caller1gcm1')
    self.assertEqual(room.Room.STATE_FULL,
                     room.get_room_state(self.HOST, room_id),
                     'Room should be full after incorrect /leave by caller')
    response = self.makePostRequest('/leave/' + room_id + '/' + 'callee1gcm1')
    self.assertEqual(room.Room.STATE_FULL,
                     room.get_room_state(self.HOST, room_id),
                     'Room should be full after incorrect /leave by callee')


if __name__ == '__main__':
  unittest.main()
