# Copyright 2015 Google Inc. All Rights Reserved.

import unittest

import webtest

import apprtc
import constants
import parameter_handling
import probers

from google.appengine.api import memcache
from google.appengine.ext import testbed


class MockRequest(object):
  def get(self, key):
    return None


class ParameterHandlingUnitTest(unittest.TestCase):

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Next, declare which service stubs you want to use.
    self.testbed.init_memcache_stub()

    self.test_app = webtest.TestApp(apprtc.app)

  def tearDown(self):
    self.testbed.deactivate()

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
    wss_url, wss_post_url = parameter_handling.get_wss_parameters(request)
    self.assertIn(constants.WSS_HOST_PORT_PAIRS[expectedIndex], wss_url)
    self.assertIn(constants.WSS_HOST_PORT_PAIRS[expectedIndex], wss_post_url)

  def testGetWssHostParameters(self):
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
