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
import room
import util

from gcmrecord import GCMRecord

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

    # Remove the room.
    result, declined_room = room.remove_room_for_declined_call(
        self.request.host_url, room_id, callee_gcm_id)
    if result != constants.RESPONSE_SUCCESS:
      self.write_response(result)
      return

    # We successfully removed the room from memcache, but should still have a
    # copy of the removed room. Use that to get the caller's GCM id.
    caller_gcm_id = declined_room.get_other_client_id(callee_gcm_id)

    # Retrieve callee's GCM ids.
    # TODO(chuckhays): Once registration is enabled, turn on restriction
    # to only return verified records.
    callee_records = GCMRecord.get_associated_records_for_gcm_id(
        callee_gcm_id, False)
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

