# Copyright 2014 Google Inc. All Rights Reserved.

import datetime
import json
import os
import time
import unittest

import analytics
from analytics_enums import EventType
from analytics_enums import LogField
from analytics_enums import ClientType
from test_util import CapturingFunction
from test_util import ReplaceFunction

from google.appengine.ext import testbed


class FakeBigQuery(object):
  """Handles long function calls to the Google API client."""

  def __init__(self):
    self.tabledata = CapturingFunction(self)
    self.insertAll = CapturingFunction(self)
    self.execute = CapturingFunction(
        {u'kind': u'bigquery#tableDataInsertAllResponse'})


class AnalyticsTest(unittest.TestCase):
  """Test the Analytics class in the analytics module."""

  # Maps from a BigQuery type to Python type.
  BQ_TYPE_MAP = {
      'string': [str, unicode],
      'integer': [int, long],
      'timestamp': [str],
  }

  def fake_build_bigquery_object(self, *_):
    self.bigquery = FakeBigQuery()
    return self.bigquery

  def now_isoformat(self):
    return datetime.datetime.fromtimestamp(self.now).isoformat()

  def create_log_dict(self, record):
    return {'body': {'rows': [{'json': record}]},
            'projectId': 'testbed-test',
            'tableId': 'analytics',
            'datasetId': 'prod'}

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Inject our own instance of bigquery.
    self.build_big_query_replacement = ReplaceFunction(
        analytics.Analytics,
        '_build_bigquery_object',
        self.fake_build_bigquery_object)

    # Inject our own time function
    self.now = time.time()
    self.time_replacement = ReplaceFunction(time, 'time', lambda: self.now)

    # Instanciate an instance.
    self.tics = analytics.Analytics()

    bqschema = json.load(open(os.path.join(os.path.dirname(__file__),
                                           'bigquery',
                                           'analytics_schema.json')))
    self.bq_field_type = {}
    for field in bqschema:
      self.bq_field_type[field['name']] = self.BQ_TYPE_MAP[field['type']]

  def tearDown(self):
    # Cleanup our replacement functions.
    del self.time_replacement
    del self.build_big_query_replacement

  def assertOneOf(self, inst, group):
    if inst not in group:
      raise AssertionError('%s is not a member of %s' % (inst, group))

  def check_bigquery_types(self, entry):
    log_data = entry['body']['rows'][0]['json']
    for field, value in log_data.iteritems():
      self.assertOneOf(type(value), self.bq_field_type[field])

  def validateBigQueryEntry(self, expected, actual):
    self.assertEqual(expected, actual)
    self.check_bigquery_types(actual)

  def testEventAsString(self):
    event_type = 'an_event_with_everything'
    room_id = 'my_room_that_is_the_best'
    time_s = self.now + 50
    client_time_s = self.now + 60
    host = 'super_host.domain.org:8112'

    log_dict = self.create_log_dict({
        LogField.TIMESTAMP: '{0}'.format(
            datetime.datetime.fromtimestamp(time_s).isoformat()),
        LogField.EVENT_TYPE: event_type,
        LogField.ROOM_ID: room_id,
        LogField.CLIENT_TIMESTAMP: '{0}'.format(
            datetime.datetime.fromtimestamp(client_time_s).isoformat()),
        LogField.HOST: host,
    })

    self.tics.report_event(event_type,
                           room_id=room_id,
                           time_ms=time_s*1000.,
                           client_time_ms=client_time_s*1000.,
                           host=host)
    self.validateBigQueryEntry(log_dict, self.bigquery.insertAll.last_kwargs)

  def testUnknowEventNumber(self):
    event_type = -1  # Numbers for events should never be negative.
    room_id = 'my_room_that_is_the_best'
    time_s = self.now + 50
    client_time_s = self.now + 60
    host = 'super_host.domain.org:8112'

    log_dict = self.create_log_dict({
        LogField.TIMESTAMP: '{0}'.format(
            datetime.datetime.fromtimestamp(time_s).isoformat()),
        LogField.EVENT_TYPE: '-1',
        LogField.ROOM_ID: room_id,
        LogField.CLIENT_TIMESTAMP: '{0}'.format(
            datetime.datetime.fromtimestamp(client_time_s).isoformat()),
        LogField.HOST: host
    })

    self.tics.report_event(event_type,
                           room_id=room_id,
                           time_ms=time_s*1000.,
                           client_time_ms=client_time_s*1000.,
                           host=host)
    self.validateBigQueryEntry(log_dict, self.bigquery.insertAll.last_kwargs)

  def testOnlyEvent(self):
    event_type = EventType.ROOM_SIZE_2
    log_dict = self.create_log_dict(
        {LogField.TIMESTAMP: '{0}'.format(self.now_isoformat()),
         LogField.EVENT_TYPE: EventType.Name[event_type]})

    self.tics.report_event(event_type)
    self.validateBigQueryEntry(log_dict, self.bigquery.insertAll.last_kwargs)

  def testEventRoom(self):
    event_type = EventType.ROOM_SIZE_2
    room_id = 'my_room_that_is_the_best'
    log_dict = self.create_log_dict({
        LogField.TIMESTAMP: '{0}'.format(self.now_isoformat()),
        LogField.EVENT_TYPE: EventType.Name[event_type],
        LogField.ROOM_ID: room_id
    })

    self.tics.report_event(event_type, room_id=room_id)
    self.validateBigQueryEntry(log_dict, self.bigquery.insertAll.last_kwargs)

  def testEventAll(self):
    # Events as they will be reported.
    event_type = EventType.ROOM_SIZE_2
    room_id = 'my_room_that_is_the_best'
    time_s = self.now + 50
    client_time_s = self.now + 60
    host = 'super_host.domain.org:8112'
    flow_id = 31337
    client_type = ClientType.ANDROID

    # How the log entries should appear in the logs.
    log_dict = self.create_log_dict({
        LogField.TIMESTAMP: '{0}'.format(
            datetime.datetime.fromtimestamp(time_s).isoformat()),
        LogField.EVENT_TYPE: EventType.Name[event_type],
        LogField.ROOM_ID: room_id,
        LogField.CLIENT_TIMESTAMP: '{0}'.format(
            datetime.datetime.fromtimestamp(client_time_s).isoformat()),
        LogField.HOST: host,
        LogField.FLOW_ID: flow_id,
        LogField.CLIENT_TYPE: ClientType.Name[client_type],
    })

    self.tics.report_event(event_type,
                           room_id=room_id,
                           time_ms=time_s*1000.,
                           client_time_ms=client_time_s*1000.,
                           host=host,
                           flow_id=flow_id,
                           client_type=client_type)
    self.validateBigQueryEntry(log_dict, self.bigquery.insertAll.last_kwargs)


class AnalyticsModuleTest(unittest.TestCase):
  """Test global functions in the analytics module."""

  def setUp(self):
    # Create a fake constructor to replace the Analytics class.
    self.analytics_fake = CapturingFunction(lambda: self.analytics_fake)
    self.analytics_fake.report_event = CapturingFunction()

    # Replace the Analytics class with the fake constructor.
    self.analytics_class_replacement = ReplaceFunction(analytics, 'Analytics',
                                                       self.analytics_fake)

  def tearDown(self):
    # This will replace the Analytics class back to normal.
    del self.analytics_class_replacement

  def testModule(self):
    event_type = 'an_event_with_everything'
    room_id = 'my_room_that_is_the_best'
    time_ms = 50*1000.
    client_time_ms = 60*1000.
    host = 'super_host.domain.org:8112'

    analytics.report_event(event_type,
                           room_id=room_id,
                           time_ms=time_ms,
                           client_time_ms=client_time_ms,
                           host=host)

    kwargs = {
        'room_id': room_id,
        'time_ms': time_ms,
        'client_time_ms': client_time_ms,
        'host': host,
        }
    self.assertEqual((event_type,), self.analytics_fake.report_event.last_args)
    self.assertEqual(kwargs, self.analytics_fake.report_event.last_kwargs)
