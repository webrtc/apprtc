# Copyright 2015 Google Inc. All Rights Reserved.

import unittest

import compute_page
import constants
import probers

from google.appengine.api import mail
from google.appengine.api import memcache
from google.appengine.ext import testbed


FAKE_ERROR_MESSAGE = 'SSL error'


class ProbersTest(unittest.TestCase):
  """Test the Probers class."""

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    self.testbed.init_mail_stub()
    self.mail_stub = self.testbed.get_stub(testbed.MAIL_SERVICE_NAME)

    self.testbed.init_memcache_stub()
    self.testbed.init_taskqueue_stub()

  def tearDown(self):
    self.testbed.deactivate()

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

  def testHandleColliderResponse(self):
    status_code = 200
    error = None
    instance = constants.WSS_INSTANCES[0]
    name = instance[constants.WSS_INSTANCE_NAME_KEY]

    # Prober success.
    result = probers.ProbeColliderPage().handle_collider_response(
        error, status_code, instance)
    self.assertEqual(True, result[constants.WSS_HOST_IS_UP_KEY])
    self.assertEqual(status_code, result[constants.WSS_HOST_STATUS_CODE_KEY])
    self.assertNotIn(constants.WSS_HOST_ERROR_MESSAGE_KEY, result)

    # No task should be queued.
    tasks = self.testbed.get_stub('taskqueue').GetTasks('default')
    self.assertEqual(0, len(tasks))

    # Last probe success flag should be true.
    last_probe_success = memcache.get(
        probers.get_collider_probe_success_key(name))
    self.assertEqual(True, last_probe_success)

    # First prober failure.
    error = 'FakeError'
    result = probers.ProbeColliderPage().handle_collider_response(
        error, status_code, instance)
    self.assertEqual(False, result[constants.WSS_HOST_IS_UP_KEY])
    self.assertEqual(status_code, result[constants.WSS_HOST_STATUS_CODE_KEY])
    self.assertIn(constants.WSS_HOST_ERROR_MESSAGE_KEY, result)

    # Restart task queued.
    tasks = self.testbed.get_stub('taskqueue').GetTasks('default')
    self.assertEqual(1, len(tasks))
    restart_url = '/compute/%s/%s/%s' % (
        compute_page.ACTION_RESTART,
        instance[constants.WSS_INSTANCE_NAME_KEY],
        instance[constants.WSS_INSTANCE_ZONE_KEY])
    self.assertEqual(restart_url, tasks[0]['url'])

    # A mail should be sent.
    messages = self.mail_stub.get_sent_messages(to='apprtc-alert@google.com')
    self.assertEqual(1, len(messages))

    # Last probe success flag should be false.
    last_probe_success = memcache.get(
        probers.get_collider_probe_success_key(name))
    self.assertEqual(False, last_probe_success)

    # Second prober failure.
    result = probers.ProbeColliderPage().handle_collider_response(
        error, status_code, instance)
    self.assertEqual(False, result[constants.WSS_HOST_IS_UP_KEY])
    self.assertEqual(status_code, result[constants.WSS_HOST_STATUS_CODE_KEY])
    self.assertIn(constants.WSS_HOST_ERROR_MESSAGE_KEY, result)

    # No new task should be queued.
    tasks = self.testbed.get_stub('taskqueue').GetTasks('default')
    self.assertEqual(1, len(tasks))

    # Another mail should be sent.
    messages = self.mail_stub.get_sent_messages(to='apprtc-alert@google.com')
    self.assertEqual(2, len(messages))

    self.testbed.get_stub('taskqueue').FlushQueue('default')

    # Prober success again.
    result = probers.ProbeColliderPage().handle_collider_response(
        None, status_code, instance)
    self.assertEqual(True, result[constants.WSS_HOST_IS_UP_KEY])
    self.assertEqual(status_code, result[constants.WSS_HOST_STATUS_CODE_KEY])
    self.assertNotIn(constants.WSS_HOST_ERROR_MESSAGE_KEY, result)

    tasks = self.testbed.get_stub('taskqueue').GetTasks('default')
    self.assertEqual(0, len(tasks))

    # Last probe success flag should be true.
    last_probe_success = memcache.get(
        probers.get_collider_probe_success_key(name))
    self.assertEqual(True, last_probe_success)
