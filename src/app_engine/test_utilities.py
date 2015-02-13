# Copyright 2015 Google Inc. All Rights Reserved.

import json
import unittest

import webtest

import analytics
import apprtc
import constants
import gcm_notify
import gcmrecord

from google.appengine.api import apiproxy_stub
from google.appengine.datastore import datastore_stub_util
from google.appengine.ext import testbed


class GCMURLFetchServiceStub(apiproxy_stub.APIProxyStub):
  def __init__(self, service_name='urlfetch'):
    super(GCMURLFetchServiceStub, self).__init__(service_name)
    self.gcm_payloads = []

  def _Dynamic_Fetch(self, request, response):
    url = request.url()
    response.set_statuscode(200)
    # Don't do anything for non GCM requests.
    if url != gcm_notify.GCM_API_URL:
      return
    # Store payloads for future verification.
    payload = request.payload()
    self.gcm_payloads.append(payload)


class BasePageHandlerTest(unittest.TestCase):
  HOST = 'http://localhost'

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()
    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Create a consistency policy that will simulate the High Replication
    # consistency model.
    self.policy = datastore_stub_util.PseudoRandomHRConsistencyPolicy()
    # Initialize the datastore stub with this policy.
    self.testbed.init_datastore_v3_stub(consistency_policy=self.policy)
    self.testbed.init_memcache_stub()

    self.test_app = webtest.TestApp(apprtc.app)

    # Fake out event reporting.
    def fake_mock_event(*args, **kwargs):
      pass
    self.oldReportEvent = analytics.report_event
    analytics.report_event = fake_mock_event

    # Fake out urlfetch service.
    self.urlfetch_stub = GCMURLFetchServiceStub()
    self.testbed._register_stub('urlfetch', self.urlfetch_stub)

    # Override GCM key so that tests will still run even if config file is
    # empty.
    gcm_notify.GCM_API_KEY = 'foo'

  def tearDown(self):
    self.testbed.deactivate()
    analytics.report_event = self.oldReportEvent

  def checkInvalidRequests(self, path, params, jsonResult=False):
    body = {x: '' for x in params}
    while body:
      response = self.makePostRequest(path, json.dumps(body))
      if jsonResult:
        self.verifyResultCode(response, constants.RESPONSE_INVALID_ARGUMENT)
      else:
        self.assertEqual(constants.RESPONSE_INVALID_ARGUMENT, response.body)
      body.popitem()

  def checkInvalidRequestsJsonResult(self, path, params):
    self.checkInvalidRequests(path, params, jsonResult=True)

  def addTestData(self):
    records = [
        ('caller1', True, [('caller1gcm1', 'caller1code1'),
                           ('caller1gcm2', 'caller1code2')]),
        ('callee1', True, [('callee1gcm1', 'callee1code1'),
                           ('callee1gcm2', 'callee1code2'),
                           ('callee1gcm3', 'callee1code3')]),
        ('caller2', True, [('caller2gcm1', 'caller2code1')]),
        ('callee2', True, [('callee2gcm1', 'callee1code1')]),
        # Unverified caller and callee.
        ('caller3', False, [('caller3gcm1', 'caller3code1')]),
        ('callee3', False, [('callee3gcm1', 'callee3code1')]),
        # Callee with mixed verification.
        ('callee4', True, [('callee4gcm1', 'callee4code1')]),
        ('callee4', False, [('callee4gcm2', 'callee4code2')]),
    ]

    for data in records:
      self.addRecord(data[0], data[2], data[1])

  def addRecord(self, user_id, gcm_ids, verify):
    for gcm_id in gcm_ids:
      gcmrecord.GCMRecord.add_or_update(user_id, gcm_id[0], gcm_id[1])
      if verify:
        gcmrecord.GCMRecord.verify(user_id, gcm_id[0], gcm_id[1])

  def makeGetRequest(self, path):
    # PhantomJS uses WebKit, so Safari is closest to the thruth.
    return self.test_app.get(path, headers={'User-Agent': 'Safari'})

  def makePostRequest(self, path, body=''):
    return self.test_app.post(path, body, headers={'User-Agent': 'Safari'})

  def createGCMInvitePayload(self, gcm_ids, room_id, caller_id):
    return gcm_notify.create_gcm_payload(
        gcm_ids, room_id, gcm_notify.create_invite_message(room_id, caller_id))

  def createGCMAcceptedPayload(self, gcm_ids, room_id):
    message = gcm_notify.create_bye_message(
        room_id, gcm_notify.GCM_MESSAGE_REASON_TYPE_ACCEPTED)
    return gcm_notify.create_gcm_payload(gcm_ids, room_id, message)

  def createGCMDeclinedPayload(self, gcm_ids, room_id):
    message = gcm_notify.create_bye_message(
        room_id, gcm_notify.GCM_MESSAGE_REASON_TYPE_DECLINED)
    return gcm_notify.create_gcm_payload(gcm_ids, room_id, message)

  def createGCMHangupPayload(self, gcm_ids, room_id):
    message = gcm_notify.create_bye_message(
        room_id, gcm_notify.GCM_MESSAGE_REASON_TYPE_HANGUP)
    return gcm_notify.create_gcm_payload(gcm_ids, room_id, message)

  def clearGCMPayloads(self):
    self.urlfetch_stub.gcm_payloads = []

  def verifyGCMPayloads(self, expected_payloads):
    payloads = self.urlfetch_stub.gcm_payloads
    self.assertEqual(len(expected_payloads), len(payloads))
    for i in xrange(len(expected_payloads)):
      self.assertEqual(expected_payloads[i], payloads[i])
    self.clearGCMPayloads()

  def verifyResultCode(self, response, expectedCode, msg=None):
    self.assertEqual(response.status_int, 200)
    self.assertEqual(expectedCode, json.loads(response.body)['result'], msg)

  def requestCallAndVerify(self, room_id, caller_gcm_id,
                           callee_id, expected_response):
    body = {
        constants.PARAM_ACTION: constants.ACTION_CALL,
        constants.PARAM_CALLER_GCM_ID: caller_gcm_id,
        constants.PARAM_CALLEE_ID: callee_id
    }

    response = self.makePostRequest('/join/' + room_id, json.dumps(body))
    self.verifyResultCode(response, expected_response)

  def requestAcceptAndVerify(self, room_id, callee_gcm_id, expected_response):
    body = {
        constants.PARAM_ACTION: constants.ACTION_ACCEPT,
        constants.PARAM_CALLEE_GCM_ID: callee_gcm_id
    }

    response = self.makePostRequest('/join/' + room_id, json.dumps(body))
    self.verifyResultCode(response, expected_response)

  def requestDeclineAndVerify(self, room_id, callee_gcm_id, expected_response):
    body = {
        constants.PARAM_CALLEE_GCM_ID: callee_gcm_id
    }

    response = self.makePostRequest('/decline/' + room_id, json.dumps(body))
    self.verifyResultCode(response, expected_response)

  def requestLeaveAndVerify(self, room_id, user_gcm_id, expected_response,
                            msg=None):
    body = {
        constants.PARAM_USER_GCM_ID: user_gcm_id
    }

    response = self.makePostRequest('/leave/' + room_id, json.dumps(body))
    self.verifyResultCode(response, expected_response, msg)
