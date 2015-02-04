# Copyright 2015 Google Inc. All Rights Reserved.

import json
import unittest
import webtest

from google.appengine.datastore import datastore_stub_util
from google.appengine.ext import ndb
from google.appengine.ext import testbed

import apprtc
import constants
import gcm_register
import gcmrecord
import room
import test_utilities

class LeavePageHandlerTest(test_utilities.BasePageHandlerTest):

  def requestLeaveAndVerify(self, room_id, user_gcm_id, expected_response):
    body = {
      constants.PARAM_USER_GCM_ID: user_gcm_id
    }
    
    response = self.makePostRequest('/leave/' + room_id, json.dumps(body))
    self.verifyResultCode(response, expected_response)

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
    self.requestLeaveAndVerify(room_id, 'callee1gcm2',
        constants.RESPONSE_SUCCESS)
    self.assertEqual(room.Room.STATE_EMPTY,
        room.get_room_state(self.HOST, room_id))
        
  def testLeaveInvalidRoomType(self):
    self.addTestData()
    # Room created by apprtc.
    room_id = 'room2'
    response = self.makePostRequest('/join/' + room_id)
    self.verifyResultCode(response, constants.RESPONSE_SUCCESS)

    self.requestLeaveAndVerify(room_id, 'caller1gcm1',
        constants.RESPONSE_INVALID_ROOM)

if __name__ == '__main__':
  unittest.main()
