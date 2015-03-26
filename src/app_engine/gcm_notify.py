#!/usr/bin/python2.7
# Copyright 2015 Google Inc. All Rights Reserved.
"""Module for communication with GCM server.
"""

import json
import logging
import time

import constants
import util

from google.appengine.api import urlfetch

# Load GCM API key from configuration file.
GCM_API_KEY = None
GCM_API_KEY_PATH = 'gcm_api_key'
GCM_API_URL = 'https://android.googleapis.com/gcm/send'

GCM_MESSAGE_REGISTRATION_ID_KEY = 'registrationId'
GCM_MESSAGE_TYPE_BYE = 'BYE'
GCM_MESSAGE_TYPE_INVITE = constants.ACK_TYPE_INVITE
GCM_MESSAGE_TYPE_RINGING = 'RINGING'
GCM_MESSAGE_TYPE_KEY = 'type'
GCM_MESSAGE_REASON_KEY = 'reason'
GCM_MESSAGE_REASON_TYPE_DECLINED = 'calleeDeclined'
GCM_MESSAGE_REASON_TYPE_ACCEPTED = 'calleeAccepted'
GCM_MESSAGE_REASON_TYPE_HANGUP = 'callerHangup'
# Time that messages are kept on GCM server in seconds. Two days.
GCM_TIME_TO_LIVE_IN_SECONDS = 2 * 24 * 60 * 60


def get_gcm_api_key():
  """Reads GCM API key from disk and caches it."""
  global GCM_API_KEY
  if GCM_API_KEY is not None:
    return GCM_API_KEY
  if not util.file_exists(GCM_API_KEY_PATH):
    logging.error('Missing GCM API key file.')
    return None
  gcm_api_key = util.read_file_contents(GCM_API_KEY_PATH)
  if gcm_api_key is None:
    logging.error('Failed to load GCM API key.')
  else:
    GCM_API_KEY = gcm_api_key
  return GCM_API_KEY


class GCMMessage(object):
  def __init__(self, gcm_id, registration_id):
    self.gcm_id = gcm_id
    self.registration_id = registration_id

  def get_gcm_payload(self):
    # Payload for GCM server. Endpoints will only see data field.
    payload_dict = {
        'data': self.get_data(),
        'registration_ids': [self.gcm_id],
        'time_to_live': GCM_TIME_TO_LIVE_IN_SECONDS
    }
    collapse_key = self.get_collapse_key()
    if collapse_key:
      payload_dict['collapse_key'] = collapse_key
    return json.dumps(payload_dict)

  def get_data(self):
    return {GCM_MESSAGE_REGISTRATION_ID_KEY: self.registration_id}

  def get_collapse_key(self):
    return None


class GCMInviteMessage(GCMMessage):
  def __init__(self, gcm_id, registration_id, room_id, caller_id, metadata):
    super(GCMInviteMessage, self).__init__(gcm_id, registration_id)
    self.room_id = room_id
    self.caller_id = caller_id
    self.metadata = metadata

  def get_data(self):
    data = super(GCMInviteMessage, self).get_data()
    data[GCM_MESSAGE_TYPE_KEY] = GCM_MESSAGE_TYPE_INVITE
    data[constants.PARAM_ROOM_ID] = self.room_id,
    data[constants.PARAM_CALLER_ID] = self.caller_id,
    data[constants.PARAM_METADATA] = self.metadata,
    return data

  def get_collapse_key(self):
    return self.room_id


class GCMByeMessage(GCMMessage):
  def __init__(self, gcm_id, registration_id, room_id, reason, metadata=None):
    super(GCMByeMessage, self).__init__(gcm_id, registration_id)
    self.room_id = room_id
    self.reason = reason
    self.metadata = metadata

  def get_data(self):
    data = super(GCMByeMessage, self).get_data()
    data[GCM_MESSAGE_TYPE_KEY] = GCM_MESSAGE_TYPE_BYE
    data[constants.PARAM_ROOM_ID] = self.room_id
    data[GCM_MESSAGE_REASON_KEY] = self.reason
    data[constants.PARAM_METADATA] = self.metadata
    return data

  def get_collapse_key(self):
    return self.room_id


class GCMRingingMessage(GCMMessage):
  def __init__(self, gcm_id, registration_id, room_id):
    super(GCMRingingMessage, self).__init__(gcm_id, registration_id)
    self.room_id = room_id

  def get_data(self):
    data = super(GCMRingingMessage, self).get_data()
    data[GCM_MESSAGE_TYPE_KEY] = GCM_MESSAGE_TYPE_RINGING
    data[constants.PARAM_ROOM_ID] = self.room_id
    return data

  def get_collapse_key(self):
    return self.room_id


def send_gcm_messages(messages):
  """Sends each GCMMessage to its endpoint.

  Makes an asynchronous post to the GCM server for each message. GCM server will
  then deliver the messages the each endpoint. Will block until all posts
  complete or fail.

  Args:
    messages: List of GCMMessage.
  """
  if not messages:
    return

  gcm_api_key = get_gcm_api_key()
  if gcm_api_key is None:
    logging.warning('Did not send GCM message due to missing API key.')
    return

  def handle_rpc_result(rpc, payload):
    result = rpc.get_result()
    status_code = result.status_code
    if status_code != 200:
      logging.error('Failed to send GCM message.')
      logging.error('Result: %d\nPayload: %s\nResponse: %s',
                    status_code, payload, result.content)
      return
    # It's possible to get a 200 but receive an error from GCM server. This will
    # be recorded in the response.
    logging.info('GCM request result:\n%s', result.content)

  # Create async requests.
  headers = {
      'Content-Type': 'application/json',
      'Authorization': ('key=%s' % gcm_api_key)
  }
  rpcs = []
  start_time = time.time()
  for message in messages:
    payload = message.get_gcm_payload()
    rpc = urlfetch.create_rpc()
    rpc.callback = lambda: handle_rpc_result(rpc, payload)
    # TODO(tkchin): investigate setting follow_redirects=False.
    urlfetch.make_fetch_call(
        rpc, GCM_API_URL, payload=payload, method=urlfetch.POST,
        headers=headers)
    logging.info('Sending message with payload: %s', payload)
    rpcs.append(rpc)

  # Wait for all the requests to finish.
  rpc_wait_start_time = time.time()
  for rpc in rpcs:
    rpc.wait()
  rpc_wait_end_time = time.time()
  logging.info('Took %.3fs to send %d GCM messages, spent %.3fs waiting for '
               'rpcs to complete.',
               rpc_wait_end_time - start_time,
               len(rpcs),
               rpc_wait_end_time - rpc_wait_start_time)
