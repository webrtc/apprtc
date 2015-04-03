# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC GCM ID Registration.

This module implements user ID registration and verification.
"""

import json
import logging

import webapp2

import constants
import gcmrecord
import util

PARAM_USER_ID = 'userId'
PARAM_GCM_ID = 'gcmId'
PARAM_CODE = 'code'
PARAM_OLD_GCM_ID = 'oldGcmId'
PARAM_NEW_GCM_ID = 'newGcmId'
PARAM_USER_ID_LIST = 'userIdList'

# Registration ID is used to uniquely identify registrations with our server.
# Upon verification, clients will receive this registration ID and should store
# it. On receiving messages via GCM, clients should check the registration ID on
# the message to see if it matches theirs and discard it if it does not. The
# reason we do this is because in some uninstallation scenarios clients may
# receive messages intended for the previously installed and registered client.
REGISTRATION_ID_KEY = 'registrationId'
VERIFIED_USER_IDS_KEY = 'verifiedUserIds'


class BindPage(webapp2.RequestHandler):
  """Implements handlers for registration APIs."""

  def write_response(self, result, registration_id=None,
                     verified_user_ids=None):
    """Helper function to write result code as JSON response."""
    response = {
        'result': result
    }
    if registration_id is not None:
      response[REGISTRATION_ID_KEY] = registration_id
    if verified_user_ids is not None:
      response[VERIFIED_USER_IDS_KEY] = verified_user_ids
    self.response.write(json.dumps(response))

  def handle_new(self):
    """Handles a new registration for a user id and gcm id pair.

    The gcm id is associated with the user id in the datastore together with a
    newly generated verification code.
    """
    logging.info('Request body: %s', self.request.body)

    msg = util.get_message_from_json(self.request.body)
    if util.has_msg_fields(msg, ((PARAM_USER_ID, basestring),
                                 (PARAM_GCM_ID, basestring))):
      # TODO(jiayl): validate the input, generate a random code, and send SMS.
      # Once this is done, turn on verified record verification in the
      # JoinPage handlers.
      self.write_response(gcmrecord.GCMRecord.add_or_update(
          msg[PARAM_USER_ID], msg[PARAM_GCM_ID], 'fake_code'))
    else:
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)

  def handle_update(self):
    """Handles an update to a verified user id and gcm id registration.

    The gcm id previously associated with the user id is replaced with the new
    gcm id in the datastore.
    """
    logging.info('Request body: %s', self.request.body)

    msg = util.get_message_from_json(self.request.body)
    if util.has_msg_fields(msg, ((PARAM_USER_ID, basestring),
                                 (PARAM_OLD_GCM_ID, basestring),
                                 (PARAM_NEW_GCM_ID, basestring))):
      self.write_response(gcmrecord.GCMRecord.update_gcm_id(
          msg[PARAM_USER_ID], msg[PARAM_OLD_GCM_ID], msg[PARAM_NEW_GCM_ID]))
    else:
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)

  def handle_verify(self):
    """Handles a verification request for a user id and gcm id registration.

    Marks a registration as verified if the supplied code matches the previously
    generated code stored in the datastore.
    """
    logging.info('Request body: %s', self.request.body)

    msg = util.get_message_from_json(self.request.body)
    if util.has_msg_fields(msg, ((PARAM_USER_ID, basestring),
                                 (PARAM_GCM_ID, basestring),
                                 (PARAM_CODE, basestring))):
      result, registration_id = gcmrecord.GCMRecord.verify(
          msg[PARAM_USER_ID], msg[PARAM_GCM_ID], msg[PARAM_CODE])
      self.write_response(result, registration_id=registration_id)
    else:
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)

  def handle_query(self):
    """Handles a query request with a list of user ids.

    Responds with a list containing the subset of the user ids in the query
    that have at least one verified gcm id associated with it.
    """
    logging.info('Request body: %s', self.request.body)

    msg = util.get_message_from_json(self.request.body)
    if util.has_msg_field(msg, PARAM_USER_ID_LIST, list):
      result = []
      for user_id in msg[PARAM_USER_ID_LIST]:
        # TODO(jiayl): Only return the verified users when SMS verification is
        # added.
        if gcmrecord.GCMRecord.get_by_user_id(user_id):
          result.append(user_id)
      logging.info('Returned list: %s', str(result))
      self.write_response(constants.RESPONSE_SUCCESS,
                          verified_user_ids=result)
    else:
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)

  def handle_del(self):
    """Handles a delete request for a user id and gcm id registration.

    Removes the supplied registration from the datastore.
    """
    logging.info('Request body: %s', self.request.body)

    msg = util.get_message_from_json(self.request.body)
    if util.has_msg_fields(msg, ((PARAM_USER_ID, basestring),
                                 (PARAM_GCM_ID, basestring))):
      gcmrecord.GCMRecord.remove(msg[PARAM_USER_ID], msg[PARAM_GCM_ID])
      self.write_response(constants.RESPONSE_SUCCESS)
    else:
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)

  def post(self, cmd):
    if cmd == 'new':
      self.handle_new()
    elif cmd == 'update':
      self.handle_update()
    elif cmd == 'verify':
      self.handle_verify()
    elif cmd == 'del':
      self.handle_del()
    elif cmd == 'query':
      self.handle_query()
    else:
      self.write_response(constants.RESPONSE_INVALID_ARGUMENT)

