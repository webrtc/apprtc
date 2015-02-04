#!/usr/bin/python2.4
#
# Copyright 2014 Google Inc. All Rights Reserved.

"""AppRTC Constants

This module contains the constants used in AppRTC Python modules.
"""
import json
import os

ROOM_MEMCACHE_EXPIRATION_SEC = 60 * 60 * 24
ROOM_MEMCACHE_RETRY_LIMIT = 100

LOOPBACK_CLIENT_ID = 'LOOPBACK_CLIENT_ID'

TURN_BASE_URL = 'https://computeengineondemand.appspot.com'
TURN_URL_TEMPLATE = '%s/turn?username=%s&key=%s'
CEOD_KEY = '4080218913'

WSS_HOST_PORT_PAIR = 'apprtc-ws.webrtc.org:443'

RESPONSE_INTERNAL_ERROR = 'ERR_INTERNAL'
RESPONSE_ROOM_FULL = 'ERR_ROOM_FULL'
RESPONSE_UNKNOWN_ROOM = 'ERR_UNKNOWN_ROOM'
RESPONSE_UNKNOWN_CLIENT = 'ERR_UNKNOWN_CLIENT'
RESPONSE_DUPLICATE_CLIENT = 'ERR_DUPLICATE_CLIENT'

RESPONSE_INVALID_CALLEE = "ERR_INVALID_CALLEE"
RESPONSE_INVALID_CALLER = "ERR_INVALID_CALLER"
RESPONSE_INVALID_ROOM = "ERR_INVALID_ROOM"
RESPONSE_INVALID_ARGUMENT = 'ERR_INVALID_ARG'
RESPONSE_INVALID_STATE = 'ERR_INVALID_STATE'
RESPONSE_INVALID_CODE = 'ERR_INVALID_CODE'
RESPONSE_NOT_FOUND = 'ERR_NOT_FOUND'

RESPONSE_CODE_SENT = 'CODE_SENT'
RESPONSE_CODE_RESENT = 'CODE_RESENT'
RESPONSE_UNVERIFIED = 'UNVERIFIED'
RESPONSE_VERIFIED = 'VERIFIED'
RESPONSE_SUCCESS = 'SUCCESS'

ACTION_CALL = 'call'
ACTION_ACCEPT = 'accept'

PARAM_ACTION = 'action'
PARAM_CALLER_GCM_ID = 'callerGcmId'
PARAM_CALLEE_ID = 'calleeId'
PARAM_CALLEE_GCM_ID = 'calleeGcmId'

BIGQUERY_URL='https://www.googleapis.com/auth/bigquery'

# Dataset used in production.
BIGQUERY_DATASET_PROD='prod'

# Dataset used when running locally.
BIGQUERY_DATASET_LOCAL='dev'

# BigQuery table within the dataset.
BIGQUERY_TABLE='analytics'

class EventType:
  # Event signifying that a room enters the state of having exactly
  # two participants.
  ROOM_SIZE_2='room_size_2'

class LogField:
  pass

with open(os.path.join(os.path.dirname(__file__),
                       'bigquery', 'analytics_schema.json')) as f:
  schema = json.load(f)
  for field in schema:
    setattr(LogField, field['name'].upper(), field['name'])
