#!/usr/bin/python2.4
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Leave Handler

This module implements leaving a call.
"""

import logging
import json
import webapp2

import constants
import parameter_handling
import room as room_module
import util

class LeavePage(webapp2.RequestHandler):
  def post(self, room_id, client_id):
    result = room_module.remove_client_from_open_room(
        self.request.host_url, room_id, client_id)
    if result['error'] is None:
      logging.info('Room ' + room_id + ' has state ' + result['room_state'])

class LeaveDirectCallPage(webapp2.RequestHandler):
  def write_response(self, result):
    self.response.write(json.dumps({
      'result': result
    }))

  def post(self, room_id):
    msg = util.get_message_from_json(self.request.body)
    if not util.has_msg_field(msg, constants.PARAM_USER_GCM_ID, basestring):
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)
      return

    client_gcm_id = msg[constants.PARAM_USER_GCM_ID]

    room = room_module.get_room(self.request.host_url, room_id)
    if room is not None and room.room_type == room_module.Room.TYPE_DIRECT:
      room_state = room.get_room_state()
      if room_state == room_module.Room.STATE_WAITING:
        # TODO (chuckhays): Send message to ringing clients to stop ringing.
        pass

    result = room_module.remove_room_for_leave_call(self.request.host_url,
                                                room_id, client_gcm_id)
    self.write_response(result)
