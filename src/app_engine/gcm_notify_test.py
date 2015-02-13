# Copyright 2015 Google Inc. All Rights Reserved.

import constants
import test_utilities


class GCMNotifyTest(test_utilities.BasePageHandlerTest):
  def testJoin(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    expected_payloads = [
        self.createGCMInvitePayload(
            ['callee1gcm1', 'callee1gcm2', 'callee1gcm3'], room_id, 'caller1'),
    ]
    self.verifyGCMPayloads(expected_payloads)

  def testJoinAndAccept(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    self.clearGCMPayloads()
    self.requestAcceptAndVerify(
        room_id, 'callee1gcm1', constants.RESPONSE_SUCCESS)
    expected_payloads = [
        self.createGCMAcceptedPayload(['callee1gcm2', 'callee1gcm3'], room_id),
    ]
    self.verifyGCMPayloads(expected_payloads)

  def testJoinAndDecline(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    self.clearGCMPayloads()
    self.requestDeclineAndVerify(
        room_id, 'callee1gcm1', constants.RESPONSE_SUCCESS)
    expected_payloads = [
        self.createGCMDeclinedPayload(
            ['caller1gcm1', 'callee1gcm2', 'callee1gcm3'], room_id),
    ]
    self.verifyGCMPayloads(expected_payloads)

  def testJoinAndLeave(self):
    self.addTestData()

    room_id = 'callercallee'

    self.requestCallAndVerify(
        room_id, 'caller1gcm1', 'callee1', constants.RESPONSE_SUCCESS)
    self.clearGCMPayloads()
    self.requestLeaveAndVerify(
        room_id, 'caller1gcm1', constants.RESPONSE_SUCCESS)
    expected_payloads = [
        self.createGCMHangupPayload(
            ['callee1gcm1', 'callee1gcm2', 'callee1gcm3'], room_id),
    ]
    self.verifyGCMPayloads(expected_payloads)

