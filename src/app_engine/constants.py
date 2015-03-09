# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Constants.

This module contains the constants used in AppRTC Python modules.
"""
import os

ROOM_MEMCACHE_EXPIRATION_SEC = 60 * 60 * 24
ROOM_MEMCACHE_RETRY_LIMIT = 100
MEMCACHE_RETRY_LIMIT = 100

LOOPBACK_CLIENT_ID = 'LOOPBACK_CLIENT_ID'

TURN_BASE_URL = 'https://computeengineondemand.appspot.com'
TURN_URL_TEMPLATE = '%s/turn?username=%s&key=%s'
CEOD_KEY = '4080218913'

# Dictionary keys in the collider instance info constant.
WSS_INSTANCE_HOST_KEY = 'host_port_pair'
WSS_INSTANCE_NAME_KEY = 'vm_name'
WSS_INSTANCE_ZONE_KEY = 'zone'
WSS_INSTANCES = [{
    WSS_INSTANCE_HOST_KEY: 'apprtc-ws.webrtc.org:443',
    WSS_INSTANCE_NAME_KEY: 'wsserver-std',
    WSS_INSTANCE_ZONE_KEY: 'us-central1-a'
}, {
    WSS_INSTANCE_HOST_KEY: 'apprtc-ws-2.webrtc.org:443',
    WSS_INSTANCE_NAME_KEY: 'wsserver-std-2',
    WSS_INSTANCE_ZONE_KEY: 'us-central1-f'
}]

WSS_HOST_PORT_PAIRS = [ins[WSS_INSTANCE_HOST_KEY] for ins in WSS_INSTANCES]

# memcache key for the active collider host.
WSS_HOST_ACTIVE_HOST_KEY = 'wss_host_active_host'

# Dictionary keys in the collider probing result.
WSS_HOST_IS_UP_KEY = 'is_up'
WSS_HOST_STATUS_CODE_KEY = 'status_code'
WSS_HOST_ERROR_MESSAGE_KEY = 'error_message'

RESPONSE_INTERNAL_ERROR = 'ERR_INTERNAL'
RESPONSE_ROOM_FULL = 'ERR_ROOM_FULL'
RESPONSE_DUPLICATE_CLIENT = 'ERR_DUPLICATE_CLIENT'

RESPONSE_INVALID_CALLEE = 'ERR_INVALID_CALLEE'
RESPONSE_INVALID_CALLER = 'ERR_INVALID_CALLER'
RESPONSE_INVALID_ROOM = 'ERR_INVALID_ROOM'
RESPONSE_INVALID_ARGUMENT = 'ERR_INVALID_ARG'
RESPONSE_INVALID_STATE = 'ERR_INVALID_STATE'
RESPONSE_INVALID_CODE = 'ERR_INVALID_CODE'
RESPONSE_INVALID_USER = 'ERR_INVALID_USER'
RESPONSE_NOT_FOUND = 'ERR_NOT_FOUND'

RESPONSE_CODE_SENT = 'CODE_SENT'
RESPONSE_CODE_RESENT = 'CODE_RESENT'
RESPONSE_UNVERIFIED = 'UNVERIFIED'
RESPONSE_VERIFIED = 'VERIFIED'
RESPONSE_SUCCESS = 'SUCCESS'
RESPONSE_INVALID_REQUEST = 'INVALID_REQUEST'

IS_DEV_SERVER = os.environ.get('APPLICATION_ID', '').startswith('dev')

ACTION_CALL = 'call'
ACTION_ACCEPT = 'accept'

PARAM_ACTION = 'action'
PARAM_CALLER_ID = 'callerId'
PARAM_CALLER_GCM_ID = 'callerGcmId'
PARAM_CALLEE_ID = 'calleeId'
PARAM_CALLEE_GCM_ID = 'calleeGcmId'
PARAM_USER_GCM_ID = 'userGcmId'
PARAM_MESSAGE = 'message'
PARAM_ROOM_ID = 'roomId'
PARAM_METADATA = 'metadata'

BIGQUERY_URL = 'https://www.googleapis.com/auth/bigquery'

# Dataset used in production.
BIGQUERY_DATASET_PROD = 'prod'

# Dataset used when running locally.
BIGQUERY_DATASET_LOCAL = 'dev'

# BigQuery table within the dataset.
BIGQUERY_TABLE = 'analytics'
