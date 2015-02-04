#!/usr/bin/python2.4
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Decline Call Handler.

This module implements declining a call.
"""

import json
import logging
import webapp2

import constants
import gcm_notify
import gcmrecord
import room
import util


class DeclinePage(webapp2.RequestHandler):
  def write_response(self, result):
    self.response.write(json.dumps({
        'result': result
    }))

  def post(self, room_id):
    msg = util.get_message_from_json(self.request.body)
    if not util.has_msg_field(msg, constants.PARAM_CALLEE_GCM_ID, basestring):
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)
      return
    callee_gcm_id = msg[constants.PARAM_CALLEE_GCM_ID]

    # Retrieve the room to figure out who the caller is.
    declined_room = room.get_room(self.request.host_url, room_id)

    # Check that room exists.
    if declined_room is None:
      logging.warning(
          'Client:%s declined unknown room:%s', callee_gcm_id, room_id)
      self.write_response(constants.RESPONSE_INVALID_ROOM)
      return

    # Check that the room supports decline.
    if declined_room.room_type != room.Room.TYPE_DIRECT:
      logging.warning(
          'Client:%s declined room:%s of type:%d',
          callee_gcm_id, room_id, declined_room.room_type)
      self.write_response(constants.RESPONSE_INVALID_ROOM)
      return

    # Check that the given callee has access to this room.
    if not declined_room.is_client_allowed(callee_gcm_id):
      logging.warning(
          'Client:%s declined room:%s but is not allowed in it',
          callee_gcm_id, room_id)
      self.write_response(constants.RESPONSE_INVALID_CALLEE)
      return

    # Check if room is full. Possible if there is a race when accept is sent
    # simultaneously from another device.
    room_state = declined_room.get_room_state()
    if room_state == room.Room.STATE_FULL:
      logging.warning('Client:%s declined full room:%s', callee_gcm_id, room_id)
      self.write_response(constants.RESPONSE_INVALID_ROOM)
      return

    # Check if room is empty.
    if room_state == room.Room.STATE_EMPTY:
      logging.warning(
          'Client:%s declined empty room:%s', callee_gcm_id, room_id)
      self.write_response(constants.RESPONSE_INVALID_ROOM)
      return

    # The client already in the room is the caller.
    # The caller should not be removing the room via decline.
    if declined_room.has_client(callee_gcm_id):
      logging.warning(
          'Client:%s declined room:%s but is the caller',
          callee_gcm_id, room_id)
      self.write_response(constants.RESPONSE_INVALID_CALLEE)
      return

    # Retrieve caller's GCM id.
    caller_gcm_id = declined_room.get_other_client_id(callee_gcm_id)

    # Remove the room now that it's no longer needed.
    result = room.remove_room(self.request.host_url, room_id)

    # Retrieve callee's other GCM ids.
    # TODO(chuckhays): Once registration is enabled, turn on restriction
    # to only return verified records.
    callee_id = gcmrecord.GCMRecord.get_user_id_for_gcm_id(callee_gcm_id, False)
    if callee_id is None:
      self.write_response(constants.RESPONSE_INVALID_CALLEE)
    callee_records = gcmrecord.GCMRecord.get_by_user_id(callee_id, False)
    if len(callee_records) < 1:
      self.write_response(constants.RESPONSE_INVALID_CALLEE)
      return

    # Notify caller and other callee endpoints about the call decline.
    gcm_ids_to_notify = [caller_gcm_id]
    for record in callee_records:
      if record.gcm_id != callee_gcm_id:
        gcm_ids_to_notify.append(record.gcm_id)
    gcm_notify.send_byes(
        gcm_ids_to_notify, room_id, gcm_notify.GCM_MESSAGE_REASON_TYPE_DECLINED)

    self.write_response(result)

