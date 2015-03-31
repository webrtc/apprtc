# Copyright 2015 Google Inc. All Rights Reserved.

"""Module for the AnalyticsPage handler."""

import json
import time

import analytics
from analytics_enums import RequestField
import constants
import webapp2


class AnalyticsPage(webapp2.RequestHandler):
  """Client Analytics data handler.

  Each POST body to the AnalyticsPage is a JSON object of the form,
  {
    'request_time_ms': <client time in milliseconds when the request was sent>,
    'type': <type of request>
    'event': {
      'event_type': <string corresponding to an attribute of EventType>,
      'event_time_ms': <client time when the event occurred>,
      'room_id': <id of the room corresponding to the event [optional]>,
    }
  }

  'request_time_ms': Required field set by the client to indicate when
                     the request was send by the client.

  'type': Required field describing the type of request. In the case
          of the 'event' type the 'event' field contains data
          pertinent to the request. However, the request type may
          correspond to one or more fields.

  'event': Data relevant to an 'event' request.

           In order to handle client clock skew, the time an event
           occurred (event_time_ms) is adjusted based on the
           difference between the client clock and the server
           clock. The difference between the client clock and server
           clock is calculated as the difference between
           'request_time_ms' provide by the client and the time at
           which the server processes the request. This ignores the
           latency of opening a connection and sending the body of the
           message to the server.

           To avoid problems with daylight savings the client should
           report 'event_time_ms' and 'request_time_ms' as UTC. The
           report will be recorded using local server time.

  """

  def _write_response(self, result):
    self.response.write(json.dumps({
        'result': result
        }))

  def _time(self):
    """Overridden in unit tests to validate time calculations."""
    return time.time()

  def post(self):
    try:
      msg = json.loads(self.request.body)
    except ValueError:
      return self._write_response(constants.RESPONSE_INVALID_REQUEST)

    response = constants.RESPONSE_INVALID_REQUEST

    # Verify required fields.
    request_type = msg.get(RequestField.TYPE)
    request_time_ms = msg.get(RequestField.REQUEST_TIME_MS)
    if request_time_ms is None or request_type is None:
      self._write_response(constants.RESPONSE_INVALID_REQUEST)
      return

    # Handle specific event types.
    if (request_type == RequestField.MessageType.EVENT and
        msg.get(RequestField.EVENT) is not None):
      response = self._handle_event(msg)

    self._write_response(response)
    return

  def _handle_event(self, msg):
    request_time_ms = msg.get(RequestField.REQUEST_TIME_MS)
    client_type = msg.get(RequestField.CLIENT_TYPE)

    event = msg.get(RequestField.EVENT)
    if event is None:
      return constants.RESPONSE_INVALID_REQUEST

    event_type = event.get(RequestField.EventField.EVENT_TYPE)
    if event_type is None:
      return constants.RESPONSE_INVALID_REQUEST

    room_id = event.get(RequestField.EventField.ROOM_ID)
    flow_id = event.get(RequestField.EventField.FLOW_ID)

    # Time that the event occurred according to the client clock.
    try:
      client_event_time_ms = float(event.get(
          RequestField.EventField.EVENT_TIME_MS))
    except (TypeError, ValueError):
      return constants.RESPONSE_INVALID_REQUEST

    # Time the request was sent based on the client clock.
    try:
      request_time_ms = float(request_time_ms)
    except (TypeError, ValueError):
      return constants.RESPONSE_INVALID_REQUEST

    # Server time at the time of request.
    receive_time_ms = self._time() * 1000.

    # Calculate event time as client event time adjusted to server
    # local time. Server clock offset is gived by the difference
    # between the time the client sent thes request and the time the
    # server received the request. This method ignores the latency of
    # sending the request to the server.
    event_time_ms = client_event_time_ms + (receive_time_ms - request_time_ms)

    analytics.report_event(event_type=event_type,
                           room_id=room_id,
                           time_ms=event_time_ms,
                           client_time_ms=client_event_time_ms,
                           host=self.request.host,
                           flow_id=flow_id, client_type=client_type)

    return constants.RESPONSE_SUCCESS
