#!/usr/bin/python2.7
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC join page.

This module implements the call join page.
"""

import json
import logging
import webapp2

import constants
import gcm_notify
import gcmrecord
import parameter_handling
import room
import util


class JoinPage(webapp2.RequestHandler):
  """Handles call join requests."""

  def write_response(self, result, params, messages):
    # TODO(tkchin): Clean up response format. For simplicity put everything in
    # params for now.
    params['messages'] = messages
    self.response.write(json.dumps({
        'result': result,
        'params': params
    }))

  def report_error(self, error):
    self.write_response(error, {}, [])

  def write_room_parameters(self, room_id, client_session_id,
                            messages, is_initiator):
    params = parameter_handling.get_room_parameters(
        self.request, room_id, client_session_id, is_initiator)
    self.write_response('SUCCESS', params, messages)

  def handle_call(self, msg, room_id):
    """Handles a new call request."""
    if not util.has_msg_fields(
        msg,
        ((constants.PARAM_CALLER_GCM_ID, basestring),
         (constants.PARAM_CALLEE_ID, basestring))):
      self.report_error(constants.RESPONSE_INVALID_ARGUMENT)
      return

    caller_gcm_id = msg[constants.PARAM_CALLER_GCM_ID]
    callee_id = msg[constants.PARAM_CALLEE_ID]
    # Look up and validate caller by gcm id.
    # TODO(chuckhays): Once registration is enabled, turn on restriction
    # to only return verified records.
    caller_records = gcmrecord.GCMRecord.get_by_gcm_id(caller_gcm_id, False)
    if len(caller_records) < 1:
      self.report_error(constants.RESPONSE_INVALID_CALLER)
      return
    caller_id = caller_records[0].user_id
    # Look up callee by id.
    # TODO(chuckhays): Once registration is enabled, turn on restriction
    # to only return verified records.
    callee_records = gcmrecord.GCMRecord.get_by_user_id(callee_id, False)
    if len(callee_records) < 1:
      self.report_error(constants.RESPONSE_INVALID_CALLEE)
      return

    room_state = room.get_room_state(self.request.host_url, room_id)
    if room_state is not None and room_state is not room.Room.STATE_EMPTY:
      logging.warning('Room ' + room_id + ' already existed when trying to ' +
                      'initiate a new call. Caller gcm id: ' + caller_gcm_id +
                      ' callee id: ' + callee_id)
      self.report_error(constants.RESPONSE_INVALID_ROOM)
      return

    callee_gcm_ids = [record.gcm_id for record in callee_records]
    allowed_gcm_ids = callee_gcm_ids + [caller_gcm_id]

    result = room.add_client_to_room(
        self.request,
        room_id,
        caller_gcm_id,
        is_loopback=False,
        room_type=room.Room.TYPE_DIRECT,
        allow_room_creation=True,
        allowed_clients=allowed_gcm_ids)
    if result['error'] is not None:
      logging.info('Error adding client to room: ' + result['error'] +
                   ', room_state=' + result['room_state'])
      self.write_response(result['error'], {}, [])
      return

    # Send ring notification to all verified GCM endpoints associated with the
    # callee's user id.
    gcm_notify.send_invites(callee_gcm_ids, room_id, caller_id)

    self.write_room_parameters(
        room_id, result['session_id'], result['messages'],
        result['is_initiator'])

    logging.info('User ' + caller_id + ' initiated call to ' + callee_id +
                 ' from gcmId ' + caller_gcm_id)
    logging.info('User ' + caller_id + ' joined room ' + room_id +
                 ' with state ' + result['room_state'])

  def handle_accept(self, msg, room_id):
    """Handles a callee accepting a call request."""
    if not util.has_msg_field(msg, constants.PARAM_CALLEE_GCM_ID, basestring):
      self.report_error(constants.RESPONSE_INVALID_ARGUMENT)
      return

    callee_gcm_id = msg[constants.PARAM_CALLEE_GCM_ID]

    if not room.has_room(self.request.host_url, room_id):
      logging.warning('Room ' + room_id + ' does not exist when trying to ' +
                      'accept a call. Callee gcm id: ' + callee_gcm_id)
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

    result = room.add_client_to_room(
        self.request,
        room_id,
        callee_gcm_id,
        is_loopback=False,
        room_type=room.Room.TYPE_DIRECT,
        allow_room_creation=False)
    if result['error'] is not None:
      logging.info('Error adding client to room: ' + result['error'] +
                   ', room_state=' + result['room_state'])
      self.write_response(result['error'], {}, [])
      return

    # Notify callee's other endpoints that an accept has been received.
    gcm_ids_to_notify = [record.gcm_id for record in callee_records
                         if record.gcm_id != callee_gcm_id]
    gcm_notify.send_byes(
        gcm_ids_to_notify, room_id, gcm_notify.GCM_MESSAGE_REASON_TYPE_ACCEPTED)

    self.write_room_parameters(
        room_id, result['session_id'], result['messages'],
        result['is_initiator'])

    logging.info('User ' + callee_id + ' accepted call ' +
                 'from gcmId ' + callee_gcm_id)
    logging.info('User ' + callee_id + ' joined room ' + room_id +
                 ' with state ' + result['room_state'])

  def post(self, room_id):
    """Handle post request for /join."""

    # Check request body to determine what action to take.
    msg = util.get_message_from_json(self.request.body)
    if util.has_msg_field(msg, constants.PARAM_ACTION, basestring):
      action = msg[constants.PARAM_ACTION]
      if action == constants.ACTION_CALL:
        self.handle_call(msg, room_id)
        return
      elif action == constants.ACTION_ACCEPT:
        self.handle_accept(msg, room_id)
        return
      else:
        self.report_error(constants.RESPONSE_INVALID_ARGUMENT)
        return

    # If there is no PARAM_ACTION field, join the room.
    client_id = util.generate_random(8)
    is_loopback = self.request.get('debug') == 'loopback'
    result = room.add_client_to_room(
        self.request,
        room_id,
        client_id,
        is_loopback=is_loopback,
        room_type=room.Room.TYPE_OPEN,
        allow_room_creation=True)
    if result['error'] is not None:
      logging.info('Error adding client to room: ' + result['error'] +
                   ', room_state=' + result['room_state'])
      self.write_response(result['error'], {}, [])
      return

    self.write_room_parameters(
        room_id, result['session_id'], result['messages'],
        result['is_initiator'])
    logging.info('User ' + client_id + ' joined room ' + room_id +
                 ' with state ' + result['room_state'])
