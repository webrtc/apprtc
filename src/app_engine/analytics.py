# Copyright 2015 Google Inc. All Rights Reserved.

"""Module for pushing analytics data to BigQuery."""

import datetime
import json
import logging
import os
import sys
import time

sys.path.append(os.path.join(os.path.dirname(__file__), 'third_party'))

import apiauth
import constants

from google.appengine.api import app_identity

class EventType(object):
  # Event signifying that a room enters the state of having exactly
  # two participants.
  ROOM_SIZE_2 = 'room_size_2'
  ICE_CONNECTION_STATE_CONNECTED = 'ice_connection_state_connected'

class LogField(object):
  pass

with open(os.path.join(os.path.dirname(__file__),
                       'bigquery', 'analytics_schema.json')) as f:
  schema = json.load(f)
  for field in schema:
    setattr(LogField, field['name'].upper(), field['name'])


class Analytics(object):
  """Class used to encapsulate analytics logic. Used interally in the module.

  All data is streamed to BigQuery.

  """

  def __init__(self):
    self.bigquery_table = constants.BIGQUERY_TABLE

    if constants.IS_DEV_SERVER:
      self.bigquery_dataset = constants.BIGQUERY_DATASET_LOCAL
    else:
      self.bigquery_dataset = constants.BIGQUERY_DATASET_PROD

    # Attempt to initialize a connection to BigQuery.
    self.bigquery = self._build_bigquery_object()
    if self.bigquery is None:
      logging.warning('Unable to build BigQuery API object. Logging disabled.')

  def _build_bigquery_object(self):
    return apiauth.build(scope=constants.BIGQUERY_URL,
                         service_name='bigquery',
                         version='v2')

  def _timestamp_from_millis(self, time_ms):
    """Convert back to seconds as float and then to ISO format."""
    return datetime.datetime.fromtimestamp(float(time_ms)/1000.).isoformat()

  def report_event(self, event_type, room_id=None, time_ms=None,
                   client_time_ms=None, host=None):
    """Report an event to BigQuery."""
    event = {LogField.EVENT_TYPE: event_type}

    if room_id is not None:
      event[LogField.ROOM_ID] = room_id

    if client_time_ms is not None:
      event[LogField.CLIENT_TIMESTAMP] = self._timestamp_from_millis(
          client_time_ms)

    if host is not None:
      event[LogField.HOST] = host

    if time_ms is None:
      time_ms = time.time() * 1000.

    event[LogField.TIMESTAMP] = self._timestamp_from_millis(time_ms)

    obj = {'rows': [{'json': event}]}

    logging.info('Event: %s', obj)
    if self.bigquery is not None:
      response = self.bigquery.tabledata().insertAll(
          projectId=app_identity.get_application_id(),
          datasetId=self.bigquery_dataset,
          tableId=self.bigquery_table,
          body=obj).execute()
      logging.info('BigQuery response: %s', response)


analytics = None


def report_event(*args, **kwargs):
  """Used by other modules to actually do logging.

  A passthrough to a global Analytics instance intialized on use.

  Args:
    *args: passed directly to Analytics.report_event.
    **kwargs: passed directly to Analytics.report_event.
  """
  global analytics

  # Initialization is delayed until the first use so that our
  # environment is ready and available. This is a problem with unit
  # tests since the testbed needs to initialized before creating an
  # Analytics instance.
  if analytics is None:
    analytics = Analytics()

  analytics.report_event(*args, **kwargs)
