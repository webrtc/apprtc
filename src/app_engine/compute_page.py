# Copyright 2015 Google Inc. All Rights Reserved.

"""Compute page for handling tasks related to compute engine."""

import logging

import webapp2

import apiauth
from google.appengine.api import app_identity
from google.appengine.api import taskqueue


# Page actions
# Get the status of an instance.
ACTION_STATUS = 'status'

# Start the compute instance if it is not already started. When an
# instance is in the TERMINATED state, it will be started. If the
# instance is already RUNNING do nothing. If the instance is in an
# intermediate state--PROVISIONING, STAGING, STOPPING--the task is
# requeued.
ACTION_START = 'start'

# Constants for the Compute Engine API
COMPUTE_STATUS = 'status'
COMPUTE_STATUS_TERMINATED = 'TERMINATED'
COMPUTE_STATUS_RUNNING = 'RUNNING'

# Seconds between API retries.
TASK_RETRY_S = 3

COMPUTE_API_URL = 'https://www.googleapis.com/auth/compute'


class ComputePage(webapp2.RequestHandler):
  """Page to handle requests against GCE."""

  def __init__(self, request, response):
    # Call initialize rather than the parent constructor fun. See:
    # https://webapp-improved.appspot.com/guide/handlers.html#overriding-init
    self.initialize(request, response)

    self.compute_service = self._build_compute_service()
    if self.compute_service is None:
      logging.warning('Unable to create Compute service object.')

  def _build_compute_service(self):
    return apiauth.build(scope=COMPUTE_API_URL,
                         service_name='compute',
                         version='v1')

  def _enqueue_start_task(self, instance, zone):
    taskqueue.add(url='/compute/start/%s/%s' % (instance, zone),
                  countdown=TASK_RETRY_S)

  def _maybe_start_instance(self, instance, zone):
    """Implementation for start action.

    Args:
      instance: Name of the instance to start.
      zone: Name of the zone the instance belongs to.

    """
    if self.compute_service is None:
      logging.warning('Unable to start Compute instance, service unavailable.')
      return

    status = self._compute_status(instance, zone)

    logging.info('GCE VM \'%s (%s)\' status: \'%s\'.',
                 instance, zone, status)

    if status == COMPUTE_STATUS_TERMINATED:
      logging.info('Starting GCE VM: %s (%s)', instance, zone)
      self.compute_service.instances().start(
          project=app_identity.get_application_id(),
          instance=instance,
          zone=zone).execute()
    elif status != COMPUTE_STATUS_RUNNING:
      # Instance is in an intermediate state: PROVISIONING, STAGING,
      # STOPPING. Thus, requeue the task.
      self._enqueue_start_task(instance, zone)

  def _compute_status(self, instance, zone):
    """Return the status of the compute instance."""
    if self.compute_service is None:
      logging.warning('Service unavailable: unable to start GCE VM: %s (%s)',
                      instance, zone)
      return

    info = self.compute_service.instances().get(
        project=app_identity.get_application_id(),
        instance=instance,
        zone=zone).execute()
    return info[COMPUTE_STATUS]

  def get(self, action, instance, zone):
    if action == ACTION_STATUS:
      self.response.write(self._compute_status(instance, zone))

  def post(self, action, instance, zone):
    if action == ACTION_START:
      self._maybe_start_instance(instance, zone)
