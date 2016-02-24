# Copyright 2014 Google Inc. All Rights Reserved.

import json
import time
import unittest

import webtest

import analytics
import apprtc
import constants
import probers
from test_util import CapturingFunction
from test_util import ReplaceFunction

from google.appengine.api import memcache
from google.appengine.ext import testbed


class MockRequest(object):
  def get(self, key):
    return None


class AppRtcUnitTest(unittest.TestCase):

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

  def tearDown(self):
    self.testbed.deactivate()

  def testGenerateRandomGeneratesStringOfRightLength(self):
    self.assertEqual(17, len(apprtc.generate_random(17)))
    self.assertEqual(23, len(apprtc.generate_random(23)))


class AppRtcPageHandlerTest(unittest.TestCase):

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Next, declare which service stubs you want to use.
    self.testbed.init_memcache_stub()

    self.test_app = webtest.TestApp(apprtc.app)

    # Fake out event reporting.
    self.time_now = time.time()

    # Fake out event reporting and capture arguments.
    self.report_event_replacement = ReplaceFunction(
        analytics,
        'report_event',
        CapturingFunction())

  def tearDown(self):
    self.testbed.deactivate()
    del self.report_event_replacement

  def makeGetRequest(self, path):
    # PhantomJS uses WebKit, so Safari is closest to the thruth.
    return self.test_app.get(path, headers={'User-Agent': 'Safari'})

  def makePostRequest(self, path, body=''):
    return self.test_app.post(path, body, headers={'User-Agent': 'Safari'})

  def verifyJoinSuccessResponse(self, response, is_initiator, room_id):
    self.assertEqual(response.status_int, 200)
    response_json = json.loads(response.body)

    self.assertEqual('SUCCESS', response_json['result'])
    params = response_json['params']
    caller_id = params['clientId']
    self.assertTrue(len(caller_id) > 0)
    self.assertEqual(is_initiator, params['isInitiator'])
    self.assertEqual(room_id, params['roomId'])
    self.assertEqual([], params['errorMessages'])
    self.assertEqual([], params['warningMessages'])
    return caller_id

  def testConnectingWithoutRoomIdServesIndex(self):
    response = self.makeGetRequest('/')
    self.assertEqual(response.status_int, 200)
    self.assertNotRegexpMatches(response.body, 'roomId:')

  def testConnectingWithRoomIdServesIndex(self):
    response = self.makeGetRequest('/r/testRoom')
    self.assertEqual(response.status_int, 200)
    self.assertRegexpMatches(response.body,
        '&#34;roomId&#34;: &#34;testRoom&#34;')

  def testJoinAndLeave(self):
    room_id = 'foo'
    # Join the caller.
    response = self.makePostRequest('/join/' + room_id)
    caller_id = self.verifyJoinSuccessResponse(response, True, room_id)

    # Join the callee.
    response = self.makePostRequest('/join/' + room_id)
    callee_id = self.verifyJoinSuccessResponse(response, False, room_id)

    # The third user will get an error.
    response = self.makePostRequest('/join/' + room_id)
    self.assertEqual(response.status_int, 200)
    response_json = json.loads(response.body)
    self.assertEqual('FULL', response_json['result'])

    # The caller and the callee leave.
    self.makePostRequest('/leave/' + room_id + '/' + caller_id)
    self.makePostRequest('/leave/' + room_id + '/' + callee_id)
    # Another user becomes the new caller.
    response = self.makePostRequest('/join/' + room_id)
    caller_id = self.verifyJoinSuccessResponse(response, True, room_id)
    self.makePostRequest('/leave/' + room_id + '/' + caller_id)

  def testCallerMessagesForwardedToCallee(self):
    room_id = 'foo'
    # Join the caller.
    response = self.makePostRequest('/join/' + room_id)
    caller_id = self.verifyJoinSuccessResponse(response, True, room_id)
    # Caller's messages should be saved.
    messages = ['1', '2', '3']
    path = '/message/' + room_id + '/' + caller_id
    for msg in messages:
      response = self.makePostRequest(path, msg)
      response_json = json.loads(response.body)
      self.assertEqual('SUCCESS', response_json['result'])

    response = self.makePostRequest('/join/' + room_id)
    callee_id = self.verifyJoinSuccessResponse(response, False, room_id)
    received_msgs = json.loads(response.body)['params']['messages']
    self.assertEqual(messages, received_msgs)

    self.makePostRequest('/leave/' + room_id + '/' + caller_id)
    self.makePostRequest('/leave/' + room_id + '/' + callee_id)

  def setWssHostStatus(self, index1, status1, index2, status2):
    probing_results = {}
    probing_results[constants.WSS_HOST_PORT_PAIRS[index1]] = {
        constants.WSS_HOST_IS_UP_KEY: status1
    }
    probing_results[constants.WSS_HOST_PORT_PAIRS[index2]] = {
        constants.WSS_HOST_IS_UP_KEY: status2
    }
    probers.ProbeColliderPage().store_instance_state(probing_results)

  def verifyRequest(self, expectedIndex):
    request = MockRequest()
    wss_url, wss_post_url = apprtc.get_wss_parameters(request)
    self.assertIn(constants.WSS_HOST_PORT_PAIRS[expectedIndex], wss_url)
    self.assertIn(constants.WSS_HOST_PORT_PAIRS[expectedIndex], wss_post_url)

  def testGetWssHostParameters(self):
    request = MockRequest()
    # With no status set, should use fallback.
    self.verifyRequest(0)

    # With an invalid value in memcache, should use fallback.
    memcache_client = memcache.Client()
    memcache_client.set(constants.WSS_HOST_ACTIVE_HOST_KEY, 'abc')
    self.verifyRequest(0)

    # With an invalid value in memcache, should use fallback.
    memcache_client = memcache.Client()
    memcache_client.set(constants.WSS_HOST_ACTIVE_HOST_KEY, ['abc', 'def'])
    self.verifyRequest(0)

    # With both hosts failing, should use fallback.
    self.setWssHostStatus(0, False, 1, False)
    self.verifyRequest(0)

    # Second host passing.
    self.setWssHostStatus(0, False, 1, True)
    self.verifyRequest(1)

    # Both hosts passing, but second host for longer.
    self.setWssHostStatus(1, True, 0, True)
    self.verifyRequest(1)


if __name__ == '__main__':
  unittest.main()
