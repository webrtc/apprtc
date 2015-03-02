# Copyright 2015 Google Inc. All Rights Reserved.

import unittest

import constants
import probers

from google.appengine.ext import testbed


FAKE_ERROR_MESSAGE = 'SSL error'


class ProbersTest(unittest.TestCase):
  """Test the Probers class."""

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

  def tearDown(self):
    pass

  def verifyActiveHost(self, old_active_host, probing_results,
                       possible_active_hosts):
    new_active_host = probers.ProbeColliderPage().create_collider_active_host(
        old_active_host,
        probing_results)
    self.assertIn(new_active_host, possible_active_hosts)

  def createEntry(
      self,
      is_up,
      status_code=None,
      error_message=None):
    result = {
        constants.WSS_HOST_IS_UP_KEY: is_up
    }
    if status_code is not None:
      result[constants.WSS_HOST_STATUS_CODE_KEY] = status_code
    if error_message is not None:
      result[constants.WSS_HOST_ERROR_MESSAGE_KEY] = error_message
    return result

  def testBuildColliderStatusEmpty(self):
    probing_results = {
        'serverC': self.createEntry(False, 500, FAKE_ERROR_MESSAGE),
        'server3': self.createEntry(True),
        'serverQ': self.createEntry(True),
    }

    old_active_host = None
    possible_active_hosts = ['server3', 'serverQ']
    self.verifyActiveHost(old_active_host, probing_results,
                          possible_active_hosts)

  def testBuildColliderNoHostsUp(self):
    probing_results = {
        'serverC': self.createEntry(False, 500, FAKE_ERROR_MESSAGE),
        'server3': self.createEntry(False),
        'serverQ': self.createEntry(False),
    }

    old_active_host = None
    possible_active_hosts = [None]
    self.verifyActiveHost(old_active_host, probing_results,
                          possible_active_hosts)

    old_active_host = 'serverC'
    possible_active_hosts = [None]
    self.verifyActiveHost(old_active_host, probing_results,
                          possible_active_hosts)

  def testBuildColliderStatus(self):
    probing_results = {
        'server3': self.createEntry(True),
        'serverC': self.createEntry(False, 500, FAKE_ERROR_MESSAGE),
        'serverD': self.createEntry(False, 500, FAKE_ERROR_MESSAGE),
        'server2': self.createEntry(True),
        'serverE': self.createEntry(True),
        'server1': self.createEntry(False, 500, FAKE_ERROR_MESSAGE),
        'serverA': self.createEntry(False, 500, FAKE_ERROR_MESSAGE),
        'serverB': self.createEntry(True),
    }

    old_active_host = 'serverE'
    possible_active_hosts = ['serverE']
    self.verifyActiveHost(old_active_host, probing_results,
                          possible_active_hosts)

    old_active_host = 'server1'
    possible_active_hosts = ['server3', 'server2', 'serverE', 'serverB']
    self.verifyActiveHost(old_active_host, probing_results,
                          possible_active_hosts)
