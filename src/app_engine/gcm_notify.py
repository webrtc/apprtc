#!/usr/bin/python2.4
# Copyright 2015 Google Inc. All Rights Reserved.
"""Module for communication with GCM server.
"""

import json
import logging

import constants

from google.appengine.api import urlfetch


# TODO(tkchin): use server API key instead of browser key once IP filtering
# rules are figured out.
GCM_API_KEY = 'AIzaSyB8JQvFhnH3ZX53207S2wRUqokoZc9wA-c'
GCM_API_URL = 'https://android.googleapis.com/gcm/send'

GCM_MESSAGE_TYPE_INVITE = 'INVITE'
GCM_MESSAGE_TYPE_BYE = 'BYE'
GCM_MESSAGE_TYPE_KEY = 'type'
GCM_MESSAGE_REASON_KEY = 'reason'
GCM_MESSAGE_REASON_TYPE_DECLINED = 'calleeDeclined'
GCM_MESSAGE_REASON_TYPE_ACCEPTED = 'calleeAccepted'
GCM_MESSAGE_REASON_TYPE_HANGUP = 'callerHangup'


def send_gcm_messages(gcm_ids, message):
  def handle_rpc_result(rpc):
    result = rpc.get_result()
    status_code = result.status_code
    if status_code != 200:
      logging.error('Failed to send GCM message. Result:%d', status_code)

  headers = {
      'Content-Type': 'application/json',
      'Authorization': ('key=%s' % GCM_API_KEY)
  }

  # Create async requests.
  rpcs = []
  for gcm_id in gcm_ids:
    payload = json.dumps({
        'data': message,
        'registration_ids': [gcm_id]
    })
    logging.info('payload: %s', str(payload))
    rpc = urlfetch.create_rpc()
    rpc.callback = lambda: handle_rpc_result(rpc)
    # TODO(tkchin): investigate setting follow_redirects=False.
    urlfetch.make_fetch_call(
        rpc, GCM_API_URL, payload=payload, method=urlfetch.POST,
        headers=headers)
    rpcs.append(rpc)

  # Wait for all the requests to finish.
  for rpc in rpcs:
    rpc.wait()


def send_invites(gcm_ids, room_id, caller_id):
  message = {
      GCM_MESSAGE_TYPE_KEY: GCM_MESSAGE_TYPE_INVITE,
      constants.PARAM_ROOM_ID: room_id,
      constants.PARAM_CALLER_ID: caller_id,
  }
  return send_gcm_messages(gcm_ids, message)


def send_byes(gcm_ids, room_id, reason):
  message = {
      GCM_MESSAGE_TYPE_KEY: GCM_MESSAGE_TYPE_BYE,
      constants.PARAM_ROOM_ID: room_id,
      GCM_MESSAGE_REASON_KEY: reason
  }
  return send_gcm_messages(gcm_ids, message)
