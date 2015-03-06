# Copyright 2015 Google Inc. All Rights Reserved.

import unittest
import webtest

import apprtc
import compute_page
from test_util import CapturingFunction
from test_util import ReplaceFunction

from google.appengine.ext import testbed


class FakeComputeService(object):
  """Handles Compute Engine service calls to the Google API client."""

  def __init__(self):
    # This is a bit hacky but the Google API is lots of function
    # chaining. This at least makes things easier to reason about as
    # opposed to making a new variable for each level.
    self.instances = CapturingFunction(lambda: self.instances)

    self.instances.start = CapturingFunction(lambda: self.instances.start)
    self.instances.start.execute = CapturingFunction()

    self.instances.stop = CapturingFunction(lambda: self.instances.stop)
    self.instances.stop.execute = CapturingFunction()

    # Change the status of an instance by setting the return value.
    self.get_return_value = None
    self.instances.get = CapturingFunction(lambda: self.instances.get)
    self.instances.get.execute = CapturingFunction(
        lambda: self.get_return_value)


class ComputePageHandlerTest(unittest.TestCase):
  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Next, declare which service stubs you want to use.
    self.testbed.init_taskqueue_stub()

    self.test_app = webtest.TestApp(apprtc.app)

    # Fake out the compute service.
    self.build_compute_service_replacement = ReplaceFunction(
        compute_page.ComputePage,
        '_build_compute_service',
        self.fake_build_compute_service)

    # Note that '_build_compute_service' is called at request
    # time. Tests need to be able to setup test data in the fake
    # before ComputePage is initialize. Thus compute_service is
    # created here and it is assumed that _build_compute_service is
    # only called once.
    self.compute_service = FakeComputeService()

    # Default testbed app name.
    self.app_id = 'testbed-test'

  def fake_build_compute_service(self, *args):
    return self.compute_service

  def tearDown(self):
    self.testbed.deactivate()
    del self.build_compute_service_replacement

  # TODO(decurtis): Extract these functions to our own test base class.
  def makePostRequest(self, path, body=''):
    return self.test_app.post(path, body, headers={'User-Agent': 'Safari'})

  def makeGetRequest(self, path):
    # PhantomJS uses WebKit, so Safari is closest to the thruth.
    return self.test_app.get(path, headers={'User-Agent': 'Safari'})

  def testGetStatus(self):
    instance = 'test-instance'
    zone = 'test-zone'

    # Fake instance has status of RUNNING
    instance_status = compute_page.COMPUTE_STATUS_RUNNING
    self.compute_service.get_return_value = {
        compute_page.COMPUTE_STATUS: instance_status
    }

    response = self.makeGetRequest('/compute/%s/%s/%s' %
                                   (compute_page.ACTION_STATUS, instance, zone))

    get_dict = {'project': self.app_id,
                'instance': instance,
                'zone': zone}

    actual_get_dict = self.compute_service.instances.get.last_kwargs
    self.assertEqual(get_dict, actual_get_dict)
    self.assertEqual(instance_status, response.body)

  def testPostStartWhenTerminated(self):
    """Test start action with instance in the TERMINATED state."""
    instance = 'test-instance'
    zone = 'test-zone'
    start_url = '/compute/%s/%s/%s' % (compute_page.ACTION_START,
                                       instance, zone)

    # Suppose that instance is TERMINATED.
    instance_status = compute_page.COMPUTE_STATUS_TERMINATED
    self.compute_service.get_return_value = {
        compute_page.COMPUTE_STATUS: instance_status
    }

    # makePostRequest will check for 200 success.
    self.makePostRequest(start_url)

    # If the state is TERMINATED then we should have a new start task.
    tasks = self.testbed.get_stub('taskqueue').GetTasks('default')
    self.assertEqual(1, len(tasks))

    # Verify start() API called only once.
    self.assertEqual(1, self.compute_service.instances.start.num_calls)

    # Check start() API called when in the TERMINATED state.
    get_dict = {'project': self.app_id,
                'instance': instance,
                'zone': zone}
    actual_get_dict = self.compute_service.instances.start.last_kwargs
    self.assertEqual(get_dict, actual_get_dict)

  def testPostStartWhenRunning(self):
    """Test start action when instance in the RUNNING state."""
    instance = 'test-instance'
    zone = 'test-zone'
    start_url = '/compute/%s/%s/%s' % (compute_page.ACTION_START,
                                       instance, zone)

    instance_status = compute_page.COMPUTE_STATUS_RUNNING
    self.compute_service.get_return_value = {
        compute_page.COMPUTE_STATUS: instance_status
    }

    self.makePostRequest(start_url)

    # No further tasks needed.
    tasks = self.testbed.get_stub('taskqueue').GetTasks('default')
    self.assertEqual(0, len(tasks))

    # Verify start() API not called.
    self.assertEqual(0, self.compute_service.instances.start.num_calls)

  def testPostStartNotRunningOrTerminated(self):
    """Test start action in an intermediate state."""
    compute_instances = self.compute_service.instances
    taskqueue = self.testbed.get_stub('taskqueue')

    instance = 'test-instance'
    zone = 'test-zone'
    start_url = '/compute/%s/%s/%s' % (compute_page.ACTION_START,
                                       instance, zone)

    # Check all intermediate states.
    for instance_status in ['PROVISIONING', 'STAGING', 'STOPPING']:
      self.compute_service.get_return_value = {
          compute_page.COMPUTE_STATUS: instance_status
      }

      self.makePostRequest(start_url)

      # Since if the instance neither RUNNING nor TERMINATED then a
      # new task should be queued.
      tasks = taskqueue.GetTasks('default')
      self.assertEqual(1, len(tasks))
      task = tasks[-1]
      self.assertEqual(start_url, task['url'])

      # Verify start() API not called.
      self.assertEqual(0, self.compute_service.instances.start.num_calls)

      # Simulate the start task running AGAIN but instance is RUNNING.
      taskqueue.FlushQueue('default')

  def testPostRestartWhenRunning(self):
    """Test restart action in a running state."""
    compute_instances = self.compute_service.instances
    taskqueue = self.testbed.get_stub('taskqueue')
    instance = 'test-instance'
    zone = 'test-zone'
    restart_url = '/compute/%s/%s/%s' % (compute_page.ACTION_RESTART,
                                       instance, zone)

    self.compute_service.get_return_value = {
        compute_page.COMPUTE_STATUS: 'RUNNING'
    }
    self.makePostRequest(restart_url)

    # A new task should be queued.
    tasks = taskqueue.GetTasks('default')
    self.assertEqual(1, len(tasks))
    task = tasks[-1]
    start_url = '/compute/%s/%s/%s' % (compute_page.ACTION_START,
                                       instance, zone)
    self.assertEqual(start_url, task['url'])

    # Verify stop() API called.
    self.assertEqual(1, self.compute_service.instances.stop.num_calls)

  def testPostRestartWhenNotRunning(self):
    """Test restart action in a non-running state."""
    compute_instances = self.compute_service.instances
    taskqueue = self.testbed.get_stub('taskqueue')
    instance = 'test-instance'
    zone = 'test-zone'
    restart_url = '/compute/%s/%s/%s' % (compute_page.ACTION_RESTART,
                                         instance, zone)

    for status in ['PROVISIONING', 'STAGING', 'STOPPING', 'TERMINATED']:
      self.compute_service.get_return_value = {
          compute_page.COMPUTE_STATUS: status
      }
      self.makePostRequest(restart_url)

      # No task should be queued.
      tasks = taskqueue.GetTasks('default')
      self.assertEqual(0, len(tasks))

      # Verify stop() API not called.
      self.assertEqual(0, self.compute_service.instances.stop.num_calls)
