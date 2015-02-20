# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Constants.

This module contains the constants used in AppRTC Python modules.
"""
import json
import os

ROOM_MEMCACHE_EXPIRATION_SEC = 60 * 60 * 24

LOOPBACK_CLIENT_ID = 'LOOPBACK_CLIENT_ID'

TURN_BASE_URL = 'https://computeengineondemand.appspot.com'
TURN_URL_TEMPLATE = '%s/turn?username=%s&key=%s'
CEOD_KEY = '4080218913'

WSS_HOST_PORT_PAIR = 'apprtc-ws.webrtc.org:443'

RESPONSE_ERROR = 'ERROR'
RESPONSE_ROOM_FULL = 'FULL'
RESPONSE_UNKNOWN_ROOM = 'UNKNOWN_ROOM'
RESPONSE_UNKNOWN_CLIENT = 'UNKNOWN_CLIENT'
RESPONSE_DUPLICATE_CLIENT = 'DUPLICATE_CLIENT'
RESPONSE_SUCCESS = 'SUCCESS'
RESPONSE_INVALID_REQUEST = "INVALID_REQUEST"

IS_DEV_SERVER = os.environ.get('APPLICATION_ID', '').startswith('dev')

BIGQUERY_URL = 'https://www.googleapis.com/auth/bigquery'

# Dataset used in production.
BIGQUERY_DATASET_PROD = 'prod'

# Dataset used when running locally.
BIGQUERY_DATASET_LOCAL = 'dev'

# BigQuery table within the dataset.
BIGQUERY_TABLE = 'analytics'
