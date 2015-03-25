import json
import time
import unittest

import analytics
from analytics_enums import RequestField, EventType, ClientType
import analytics_page
import apprtc
import constants
from test_util import CapturingFunction
from test_util import ReplaceFunction
import webtest

from google.appengine.ext import testbed


class AnalyticsPageHandlerTest(unittest.TestCase):

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

    self.analytics_page_now_replacement = ReplaceFunction(
        analytics_page.AnalyticsPage,
        '_time',
        self.fake_time)

  def tearDown(self):
    self.testbed.deactivate()
    del self.report_event_replacement
    del self.analytics_page_now_replacement

  def fake_time(self):
    return self.time_now

  def makePostRequest(self, path, body=''):
    return self.test_app.post(path, body, headers={'User-Agent': 'Safari'})

  def testAnalyticsPage(self):
    # self.time_ms will be the time the request is recieved by AppRTC
    self.time_now = 11.0
    request_time_ms = 10.0 * 1000
    event_time_ms = 8.0 * 1000
    # The client time (request_time) is one second behind the server
    # time (self.time_now) so the event time, as the server sees it,
    # should be one second ahead of the actual event time recorded by
    # the client.
    event_time_server_ms = 9.0 * 1000
    # Default host for the test server.
    host = 'localhost:80'

    room_id = 'foo'
    flow_id = 1337
    event_type = EventType.ICE_CONNECTION_STATE_CONNECTED
    client_type = ClientType.ANDROID

    # Test with all optional attributes.
    request = {
        RequestField.TYPE: RequestField.MessageType.EVENT,
        RequestField.REQUEST_TIME_MS: request_time_ms,
        RequestField.CLIENT_TYPE: client_type,
        RequestField.EVENT: {
            RequestField.EventField.EVENT_TYPE: event_type,
            RequestField.EventField.EVENT_TIME_MS: event_time_ms,
            RequestField.EventField.ROOM_ID: room_id,
            RequestField.EventField.FLOW_ID: flow_id,
            }
        }

    response = self.makePostRequest('/a/', body=json.dumps(request))
    response_body = json.loads(response.body)

    self.assertEqual(constants.RESPONSE_SUCCESS, response_body['result'])

    expected_kwargs = dict(event_type=event_type,
                           room_id=room_id,
                           time_ms=event_time_server_ms,
                           client_time_ms=event_time_ms,
                           host=host,
                           flow_id=flow_id,
                           client_type=client_type,)
    self.assertEqual(expected_kwargs, analytics.report_event.last_kwargs)

    # Test without optional attributes.
    request = {
        RequestField.TYPE: RequestField.MessageType.EVENT,
        RequestField.REQUEST_TIME_MS: request_time_ms,
        RequestField.EVENT: {
            RequestField.EventField.EVENT_TYPE: event_type,
            RequestField.EventField.EVENT_TIME_MS: event_time_ms,
            }
        }

    response = self.makePostRequest('/a/', body=json.dumps(request))
    response_body = json.loads(response.body)

    self.assertEqual(constants.RESPONSE_SUCCESS, response_body['result'])

    expected_kwargs = dict(event_type=event_type,
                           room_id=None,
                           time_ms=event_time_server_ms,
                           client_time_ms=event_time_ms,
                           host=host,
                           flow_id=None,
                           client_type=None)

    self.assertEqual(expected_kwargs, analytics.report_event.last_kwargs)

  def testAnalyticsPageFail(self):
    # Test empty body.
    response = self.makePostRequest('/a/')
    response_body = json.loads(response.body)
    self.assertEqual(constants.RESPONSE_INVALID_REQUEST,
                     response_body['result'])

    # Test missing individual required attributes.
    room_id = 'foo'
    event_type = EventType.ICE_CONNECTION_STATE_CONNECTED
    time_ms = 1337

    # Fully populated event and request.
    request = {
        RequestField.TYPE: RequestField.MessageType.EVENT,
        RequestField.REQUEST_TIME_MS: time_ms,
        RequestField.EVENT: {
            RequestField.EventField.EVENT_TYPE: event_type,
            RequestField.EventField.EVENT_TIME_MS: time_ms,
            RequestField.EventField.ROOM_ID: room_id,
            }
        }

    # Unknown type of analytics request
    request_unknown_type = request.copy()
    request_unknown_type[RequestField.TYPE] = 'crazy_brains'
    response = self.makePostRequest(
        '/a/', body=json.dumps(request_unknown_type))
    response_body = json.loads(response.body)
    self.assertEqual(constants.RESPONSE_INVALID_REQUEST,
                     response_body['result'])

    # Missing required members of the request.
    for member in (RequestField.TYPE, RequestField.REQUEST_TIME_MS):
      tmp_request = request.copy()
      del tmp_request[member]
      response = self.makePostRequest(
          '/a/', body=json.dumps(tmp_request))
      response_body = json.loads(response.body)
      self.assertEqual(constants.RESPONSE_INVALID_REQUEST,
                       response_body['result'])

    # Missing required members of the event.
    for member in (RequestField.EventField.EVENT_TYPE,
                   RequestField.EventField.EVENT_TIME_MS):
      tmp_request = request.copy()
      tmp_event = request[RequestField.EVENT].copy()
      del tmp_event[member]
      tmp_request[RequestField.EVENT] = tmp_event
      response = self.makePostRequest(
          '/a/', body=json.dumps(tmp_request))
      response_body = json.loads(response.body)
      self.assertEqual(constants.RESPONSE_INVALID_REQUEST,
                       response_body['result'])
