#!/usr/bin/python2.7
# Copyright 2015 Google Inc. All Rights Reserved.
"""Module for communication with GCM server.
"""

import json
import logging
import os
import time

import constants

from google.appengine.api import urlfetch

# Load GCM API key from configuration file.
GCM_API_KEY = None
GCM_API_URL = 'https://android.googleapis.com/gcm/send'

GCM_MESSAGE_TYPE_BYE = 'BYE'
GCM_MESSAGE_TYPE_INVITE = 'INVITE'
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
  try:
    config_path = os.path.join(os.path.dirname(__file__), 'gcm_config.json')
    with open(config_path, 'r') as f:
      gcm_config = json.loads(f.read())
      gcm_api_key = gcm_config.get('GCM_API_KEY')
    if not gcm_api_key:
      logging.error('Failed to load GCM API key from config file.')
    else:
      GCM_API_KEY = gcm_api_key
  except IOError as e:
    logging.error('Failed to open GCM config file: %s', str(e))
  return GCM_API_KEY


def send_gcm_messages(gcm_ids, message, collapse_key):
  """Sends the message to each endpoint specified in gcm_ids.

  Makes a synchronous post to the GCM server with the appropriate payload
  format.

  Args:
    gcm_ids: List of verified GCM ids.
    message: Dictionary containing custom data.
    collapse_key: String used for GCM collapse key.
  """
  gcm_api_key = get_gcm_api_key()
  if gcm_api_key is None:
    logging.warning('Did not send GCM message due to missing API key.')
    return

  headers = {
      'Content-Type': 'application/json',
      'Authorization': ('key=%s' % gcm_api_key)
  }
  payload = create_gcm_payload(gcm_ids, collapse_key, message)
  start_time = time.time()
  # TODO(tkchin): investigate setting follow_redirects=False.
  result = urlfetch.fetch(url=GCM_API_URL,
                          payload=payload,
                          method=urlfetch.POST,
                          headers=headers)
  end_time = time.time()
  logging.info('Took %.3fs to send GCM message request with %d endpoints.',
               end_time - start_time,
               len(gcm_ids))
  status_code = result.status_code
  if status_code != 200:
    logging.error('Failed to send GCM message. Result:%d', status_code)
    logging.error('Response: %s', result.content)
    return
  # It's possible to get a 200 but receive an error from GCM server. This will
  # be recorded in the response.
  logging.info('GCM request result:\n%s', result.content)


def create_gcm_payload(gcm_ids, collapse_key, data):
  return json.dumps({
      'data': data,
      'registration_ids': gcm_ids,
      'collapse_key': collapse_key,
      'time_to_live': GCM_TIME_TO_LIVE_IN_SECONDS
  })


def create_invite_message(room_id, caller_id):
  return {
      GCM_MESSAGE_TYPE_KEY: GCM_MESSAGE_TYPE_INVITE,
      constants.PARAM_ROOM_ID: room_id,
      constants.PARAM_CALLER_ID: caller_id,
  }


def send_invites(gcm_ids, room_id, caller_id):
  message = create_invite_message(room_id, caller_id)
  return send_gcm_messages(gcm_ids, message, room_id)


def create_bye_message(room_id, reason):
  return {
      GCM_MESSAGE_TYPE_KEY: GCM_MESSAGE_TYPE_BYE,
      constants.PARAM_ROOM_ID: room_id,
      GCM_MESSAGE_REASON_KEY: reason
  }


def send_byes(gcm_ids, room_id, reason):
  message = create_bye_message(room_id, reason)
  return send_gcm_messages(gcm_ids, message, room_id)
