# Copyright 2014 Google Inc. All Rights Reserved.

import json
import time
import unittest

import webtest

import analytics
import apprtc
from test_util import CapturingFunction
from test_util import ReplaceFunction

from google.appengine.ext import testbed


class AppRtcUnitTest(unittest.TestCase):

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

  def tearDown(self):
    self.testbed.deactivate()


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

  def testConnectingWithoutRoomIdServesIndex(self):
    response = self.makeGetRequest('/')
    self.assertEqual(response.status_int, 200)
    self.assertNotRegexpMatches(response.body, 'roomId:')

  def testConnectingWithRoomIdServesIndex(self):
    response = self.makeGetRequest('/r/testRoom')
    self.assertEqual(response.status_int, 200)
    self.assertRegexpMatches(response.body, 'roomId: \'testRoom\'')

if __name__ == '__main__':
  unittest.main()
