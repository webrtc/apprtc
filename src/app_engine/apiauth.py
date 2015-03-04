# Copyright 2015 Google Inc. All Rights Reserved.

"""Google API auth utilities."""

import json
import os
import sys

# Insert our third-party libraries first to avoid conflicts with appengine.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'third_party'))

from apiclient import discovery
import httplib2
import oauth2client.appengine
import oauth2client.client

import constants


def build(scope, service_name, version):
  """Build a service object if authorization is available."""
  credentials = None
  if constants.IS_DEV_SERVER:
    # Local instances require a 'secrets.json' file.
    secrets_path = os.path.join(os.path.dirname(__file__), 'secrets.json')
    if os.path.exists(secrets_path):
      with open(secrets_path) as f:
        auth = json.load(f)
        credentials = oauth2client.client.SignedJwtAssertionCredentials(
            auth['client_email'], auth['private_key'], scope)
  else:
    # Use the GAE service credentials.
    credentials = oauth2client.appengine.AppAssertionCredentials(scope=scope)

  if credentials is None:
    return None

  http = credentials.authorize(httplib2.Http())
  return discovery.build(service_name, version, http=http)
