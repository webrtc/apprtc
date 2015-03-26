#!/usr/bin/python2.7
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC ack page.

This module implements the ack page.
"""

import json
import logging
import webapp2

import constants
import gcm_notify
from gcm_notify import GCMRingingMessage
import gcmrecord
import room
import util


class AckPage(webapp2.RequestHandler):
  """Handles ack requests."""

  def write_response(self, result):
    self.response.write(json.dumps({
        'result': result,
    }))

  def report_error(self, error):
    self.write_response(error)

  def handle_ack_invite(self, msg):
    """Handles a callee acknowledging the incoming call."""
    if (not util.has_msg_field(msg, constants.PARAM_CALLEE_GCM_ID, basestring)
        or not util.has_msg_field(msg, constants.PARAM_ROOM_ID, basestring)):
      self.report_error(constants.RESPONSE_INVALID_ARGUMENT)
      return

    callee_gcm_id = msg[constants.PARAM_CALLEE_GCM_ID]
    room_id = msg[constants.PARAM_ROOM_ID]

    call_room = room.get_room(self.request.host_url, room_id)
    if not call_room:
      logging.warning('Room ' + room_id + ' does not exist when trying to ' +
                      'acknowledge a call. Callee gcm id: ' + callee_gcm_id)
      self.report_error(constants.RESPONSE_INVALID_ROOM)
      return

    # Look up and validate callee by gcm id.
    # TODO(chuckhays): Once registration is enabled, turn on restriction
    # to only return verified records.
    callee_records = gcmrecord.GCMRecord.get_associated_records_for_gcm_id(
        callee_gcm_id, False)
    if len(callee_records) < 1:
      self.report_error(constants.RESPONSE_INVALID_CALLEE)
      return
    callee_id = callee_records[0].user_id

    # There should only be 1 client in the room, the caller.
    # If this is not the current state of the room, we won't send a
    # notification. This could happen if one of the callee's devices
    # starts ringing after the call has already been accepted or declined.
    room_state = call_room.get_room_state()
    if room_state != room.Room.STATE_WAITING:
      logging.info('Room ' + room_id + ' is not in WAITING state ' +
                   ' when trying to acknowledge a call. State: ' +
                   str(room_state) + ' Callee gcm id: ' + callee_gcm_id)
      self.report_error(constants.RESPONSE_INVALID_ROOM)
      return

    if not call_room.is_client_allowed(callee_gcm_id):
      logging.warning('Room ' + room_id + ' does not allow callee id: ' +
                      callee_id + '(' + callee_gcm_id + ')')
      self.report_error(constants.RESPONSE_INVALID_CALLEE)
      return

    caller_gcm_id = call_room.get_other_client_id(callee_gcm_id)
    if not caller_gcm_id:
      logging.error('Could not find caller gcm id when trying to'
                    ' acknowledge a call. Room: ' + room_id +
                    ' Callee gcm id: ' + callee_gcm_id)
      self.report_error(constants.RESPONSE_INVALID_ROOM)
      return

    # Get caller record.
    caller_record = gcmrecord.GCMRecord.get_by_gcm_id(caller_gcm_id, False)
    if not caller_record:
      logging.error('Could not find caller record for gcm_id: %s',
                    caller_gcm_id)
      self.report_error(constants.RESPONSE_INTERNAL_ERROR)
      return
    # Notify caller that callee has acknowledged the call and is ringing.
    gcm_message = GCMRingingMessage(caller_gcm_id,
                                    caller_record.registration_id,
                                    room_id)
    gcm_notify.send_gcm_messages([gcm_message])

    logging.info('User ' + callee_id + ' acknowledged call ' +
                 'from gcmId ' + callee_gcm_id)

    self.write_response(constants.RESPONSE_SUCCESS)

  def post(self):
    """Handle post request for /ack."""
    logging.info('Request body: %s', self.request.body)

    # Check request body to determine what action to take.
    if self.request.body:
      msg = util.get_message_from_json(self.request.body)
      if util.has_msg_field(msg, constants.PARAM_TYPE, basestring):
        ack_type = msg[constants.PARAM_TYPE]
        if ack_type == constants.ACK_TYPE_INVITE:
          self.handle_ack_invite(msg)
          return

    self.report_error(constants.RESPONSE_INVALID_ARGUMENT)
