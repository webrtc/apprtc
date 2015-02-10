#!/usr/bin/python2.4
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Message Handler.

This module implements message passing.
"""

import json
import logging

import webapp2

import constants
import parameter_handling
import room as room_module

from google.appengine.api import urlfetch


class MessagePage(webapp2.RequestHandler):
  """Handler for /message."""

  def write_response(self, result):
    content = json.dumps({'result': result})
    self.response.write(content)

  def send_message_to_collider(self, room_id, client_session_id, message):
    """Forward message to the collider service."""
    logging.info('Forwarding message to collider for room ' + room_id +
                 ' client ' + client_id)
    wss_post_url = parameter_handling.get_wss_parameters(self.request)[1]
    url = wss_post_url + '/' + room_id + '/' + client_session_id
    result = urlfetch.fetch(url=url,
                            payload=message,
                            method=urlfetch.POST)
    if result.status_code != 200:
      logging.error(
          'Failed to send message to collider: %d', (result.status_code))
      # TODO(tkchin): better error handling.
      self.error(500)
      return
    self.write_response(constants.RESPONSE_SUCCESS)

  def post(self, room_id, client_session_id):
    message_json = self.request.body
    result = room_module.save_message_from_client(
        self.request.host_url, room_id, client_session_id, message_json)
    if result['error'] is not None:
      self.write_response(result['error'])
      return
    self.write_response(constants.RESPONSE_SUCCESS)
    if not result['saved']:
      # Other client joined, forward to collider. Do this outside the lock.
      # Note: this may fail in local dev server due to not having the right
      # certificate file locally for SSL validation.
      # Note: loopback scenario follows this code path.
      # TODO(tkchin): consider async fetch here.
      self.send_message_to_collider(room_id, client_session_id, message_json)
