# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Decline Call Handler.

This module implements declining a call.
"""

import json
import logging
import webapp2

import constants
import gcm_notify
from gcm_notify import GCMByeMessage
from gcmrecord import GCMRecord
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

    # Retrieve caller record and send notifications.
    caller_record = GCMRecord.get_by_gcm_id(caller_gcm_id, False)
    gcm_messages = []
    reason = gcm_notify.GCM_MESSAGE_REASON_TYPE_DECLINED
    # Metadata is passed from callee to caller and other endpoints. Used to
    # indicate why the call was declined, such as being in another call.
    metadata = msg.get(constants.PARAM_METADATA)
    if not caller_record:
      logging.error('Unable to find caller record for gcm_id: %s',
                    caller_gcm_id)
      # We still want to attempt to notify callees despite bad state.
      result = constants.RESPONSE_INTERNAL_ERROR
    else:
      # Notify caller about the call decline.
      gcm_messages.append(GCMByeMessage(caller_gcm_id,
                                        caller_record.registration_id,
                                        room_id,
                                        reason,
                                        metadata))
    # Notify other callee endpoints about the call decline.
    for record in callee_records:
      if record.gcm_id != callee_gcm_id:
        gcm_messages.append(GCMByeMessage(record.gcm_id,
                                          record.registration_id,
                                          room_id,
                                          reason,
                                          metadata))
    gcm_notify.send_gcm_messages(gcm_messages)

    self.write_response(result)

