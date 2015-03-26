# Copyright 2015 Google Inc. All Rights Reserved.

import constants
import gcm_notify
from gcm_notify import GCMByeMessage
from gcm_notify import GCMInviteMessage
import test_utilities

TEST_METADATA = 'foobar'


class GCMNotifyTest(test_utilities.BasePageHandlerTest):

  def testJoin(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id,
        'caller1gcm1',
        'callee1',
        constants.RESPONSE_SUCCESS,
        TEST_METADATA)

    expected_payloads = []
    for gcm_id in ['callee1gcm1', 'callee1gcm2', 'callee1gcm3']:
      registration_id = self.getRegistrationId(gcm_id)
      message = GCMInviteMessage(gcm_id,
                                 registration_id,
                                 room_id,
                                 'caller1',
                                 TEST_METADATA)
      expected_payloads.append(message.get_gcm_payload())

    self.verifyGCMPayloads(expected_payloads)

  def testJoinNoMetadata(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id,
        'caller1gcm1',
        'callee1',
        constants.RESPONSE_SUCCESS,
        None)
    expected_payloads = []
    for gcm_id in ['callee1gcm1', 'callee1gcm2', 'callee1gcm3']:
      registration_id = self.getRegistrationId(gcm_id)
      message = GCMInviteMessage(gcm_id,
                                 registration_id,
                                 room_id,
                                 'caller1',
                                 None)
      expected_payloads.append(message.get_gcm_payload())
    self.verifyGCMPayloads(expected_payloads)

  def testJoinAndAccept(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    self.clearGCMPayloads()
    self.requestAcceptAndVerify(
        room_id, 'callee1gcm1', constants.RESPONSE_SUCCESS)

    expected_payloads = []
    for gcm_id in ['callee1gcm2', 'callee1gcm3']:
      registration_id = self.getRegistrationId(gcm_id)
      message = GCMByeMessage(gcm_id,
                              registration_id,
                              room_id,
                              gcm_notify.GCM_MESSAGE_REASON_TYPE_ACCEPTED)
      expected_payloads.append(message.get_gcm_payload())
    self.verifyGCMPayloads(expected_payloads)

  def testJoinAndDecline(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    self.clearGCMPayloads()
    self.requestDeclineAndVerify(
        room_id, 'callee1gcm1', constants.RESPONSE_SUCCESS)
    expected_payloads = []
    for gcm_id in ['caller1gcm1', 'callee1gcm2', 'callee1gcm3']:
      registration_id = self.getRegistrationId(gcm_id)
      message = GCMByeMessage(gcm_id,
                              registration_id,
                              room_id,
                              gcm_notify.GCM_MESSAGE_REASON_TYPE_DECLINED)
      expected_payloads.append(message.get_gcm_payload())
    self.verifyGCMPayloads(expected_payloads)

  def testJoinAndDeclineWithMetadata(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    self.clearGCMPayloads()
    metadata = {'reason': 'busy'}
    self.requestDeclineAndVerify(
        room_id, 'callee1gcm1', constants.RESPONSE_SUCCESS, metadata)

    expected_payloads = []
    for gcm_id in ['caller1gcm1', 'callee1gcm2', 'callee1gcm3']:
      registration_id = self.getRegistrationId(gcm_id)
      message = GCMByeMessage(gcm_id,
                              registration_id,
                              room_id,
                              gcm_notify.GCM_MESSAGE_REASON_TYPE_DECLINED,
                              metadata)
      expected_payloads.append(message.get_gcm_payload())
    self.verifyGCMPayloads(expected_payloads)

  def testJoinAndLeave(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    self.clearGCMPayloads()
    self.requestLeaveAndVerify(
        room_id, 'caller1gcm1', constants.RESPONSE_SUCCESS)
    expected_payloads = []
    for gcm_id in ['callee1gcm1', 'callee1gcm2', 'callee1gcm3']:
      registration_id = self.getRegistrationId(gcm_id)
      message = GCMByeMessage(gcm_id,
                              registration_id,
                              room_id,
                              gcm_notify.GCM_MESSAGE_REASON_TYPE_HANGUP)
      expected_payloads.append(message.get_gcm_payload())
    self.verifyGCMPayloads(expected_payloads)

