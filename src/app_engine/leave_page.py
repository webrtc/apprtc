#!/usr/bin/python2.7
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Leave Handler.

This module implements leaving a call.
"""

import json
import logging

import webapp2

import constants
import gcm_notify
from gcm_notify import GCMByeMessage
import gcmrecord
import room as room_module
import util


class LeavePage(webapp2.RequestHandler):
  def post(self, room_id, client_session_id):
    result = room_module.remove_client_from_open_room(
        self.request.host_url, room_id, client_session_id)
    if result['error'] is None:
      logging.info('Room ' + room_id + ' has state ' + result['room_state'])


class LeaveDirectCallPage(webapp2.RequestHandler):
  def write_response(self, result):
    self.response.write(json.dumps({
        'result': result
    }))

  def post(self, room_id):
    """Handle post request for /leave."""
    msg = util.get_message_from_json(self.request.body)
    if not util.has_msg_field(msg, constants.PARAM_USER_GCM_ID, basestring):
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)
      return

    client_gcm_id = msg[constants.PARAM_USER_GCM_ID]
    result, room = room_module.remove_room_for_leave_call(
        self.request.host_url, room_id, client_gcm_id)
    if result != constants.RESPONSE_SUCCESS:
      self.write_response(result)
      return

    room_state = room.get_room_state()
    if room_state == room_module.Room.STATE_WAITING:
      # This is the caller hanging up. Send notification to all other endpoints.
      gcm_ids_to_notify = [gcm_id for gcm_id in room.allowed_clients
                           if gcm_id != client_gcm_id]
      gcm_messages = []
      for gcm_id in gcm_ids_to_notify:
        record = gcmrecord.GCMRecord.get_by_gcm_id(gcm_id)
        if not record:
          logging.error('Failed to find record for gcm id: %s', gcm_id)
          self.write_response(constants.RESPONSE_INTERNAL_ERROR)
          return
        gcm_message = GCMByeMessage(gcm_id,
                                    record.registration_id,
                                    room_id,
                                    gcm_notify.GCM_MESSAGE_REASON_TYPE_HANGUP)
        gcm_messages.append(gcm_message)
      gcm_notify.send_gcm_messages(gcm_messages)

    self.write_response(result)
