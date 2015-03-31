# Copyright 2015 Google Inc. All Rights Reserved.

import json
import unittest

import constants
import test_utilities


class AckPageHandlerTest(test_utilities.BasePageHandlerTest):

  def testAckRingingInvalidRoom(self):
    self.addTestData()
    # Room doesn't exist.
    self.requestAckInviteAndVerify('invalidCallee', 'newRoom',
                                   constants.RESPONSE_INVALID_ROOM)

  def testAckRingingInvalidCallee(self):
    self.addTestData()
    # Callee doesn't exist.
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    self.requestAckInviteAndVerify('invalidCallee', room_id,
                                   constants.RESPONSE_INVALID_CALLEE)

  def testAckRingingWrongRoom(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    # Callee not allowed in this room.
    self.requestAckInviteAndVerify('callee2gcm1', room_id,
                                   constants.RESPONSE_INVALID_CALLEE)

  def testAckRinging(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)

    self.clearGCMPayloads()
    self.requestAckInviteAndVerify('callee1gcm1', room_id,
                                   constants.RESPONSE_SUCCESS)

    expected_payloads = [
        self.createGCMRingingPayload(
            ['caller1gcm1'],
            room_id),
    ]
    self.verifyGCMPayloads(expected_payloads)

    self.requestAckInviteAndVerify('callee1gcm2', room_id,
                                   constants.RESPONSE_SUCCESS)
    self.verifyGCMPayloads(expected_payloads)

  def testAckRingingRoomFull(self):
    self.addTestData()
    room_id = 'callercallee'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    self.requestAcceptAndVerify(room_id, 'callee1gcm1',
                                constants.RESPONSE_SUCCESS)
    # Room already full.
    self.requestAckInviteAndVerify('callee1gcm1', room_id,
                                   constants.RESPONSE_INVALID_ROOM)

  def testAckRingingEmptyRoom(self):
    self.addTestData()
    room_id = 'callercallee1'
    self.requestCallAndVerify(room_id, 'caller1gcm1', 'callee1',
                              constants.RESPONSE_SUCCESS)
    self.requestLeaveAndVerify(room_id, 'caller1gcm1',
                               constants.RESPONSE_SUCCESS)
    self.requestAckInviteAndVerify('callee1gcm1', room_id,
                                   constants.RESPONSE_INVALID_ROOM)

  def testAckInvalidInput(self):
    body = {
        constants.PARAM_TYPE: constants.ACK_TYPE_INVITE,
        constants.PARAM_CALLEE_GCM_ID: 'callee1gcm1',
        constants.PARAM_ROOM_ID: 'room',
    }
    self.checkInvalidRequestsJsonResult('/ack', body.keys())

  def requestAckInviteAndVerify(self, calleeGcmId, roomId, expectedCode):
    body = {
        constants.PARAM_TYPE: constants.ACK_TYPE_INVITE,
        constants.PARAM_CALLEE_GCM_ID: calleeGcmId,
        constants.PARAM_ROOM_ID: roomId,
    }
    response = self.makePostRequest('/ack', json.dumps(body))
    self.verifyResultCode(response, expectedCode)

if __name__ == '__main__':
  unittest.main()
