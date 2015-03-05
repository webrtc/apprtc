#!/usr/bin/python2.4
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""Client model.

This module implements the client data model.
"""

import json
import logging
import uuid


# For OPEN type rooms, client_id is a generated random number.
# For DIRECT type rooms, client_id is the device's gcm id.
# (room_id, client_id) pairs are 'unique', but in the OPEN case, client_id
# values may not be. This uniqueness is not enforced however and bad things
# may happen if RNG generates non-unique numbers for client_ids. We also
# have a special loopback client id.
# The session_id value is an uuid. It is used by clients as the identifier
# to the WSS server, calls to /message and calls to /leave in an OPEN type room.
class Client(object):
  """Implements model for connecting clients."""

  INITIATOR_KEY = 'initiator'
  MESSAGES_KEY = 'messages'
  SESSION_ID_KEY = 'session_id'

  def __init__(self, is_initiator):
    self.is_initiator = is_initiator
    self.messages = []
    self.session_id = str(uuid.uuid1())

  def add_message(self, msg):
    self.messages.append(msg)

  def clear_messages(self):
    self.messages = []

  def set_initiator(self, initiator):
    self.is_initiator = initiator

  def get_json(self):
    return json.dumps({
        Client.INITIATOR_KEY: self.is_initiator,
        Client.MESSAGES_KEY: self.messages,
        Client.SESSION_ID_KEY: self.session_id
    })

  @classmethod
  def parse_json(cls, json_string):
    try:
      client_dictionary = json.loads(json_string)
      required_keys = [
          cls.INITIATOR_KEY, cls.MESSAGES_KEY, cls.SESSION_ID_KEY
      ]
      if not all([key in client_dictionary for key in required_keys]):
        logging.error('Client JSON missing required fields.')
        return None
    except ValueError as e:
      logging.error('Error parsing Client JSON: %s', str(e))
      return None
    client = Client(client_dictionary.get(cls.INITIATOR_KEY))
    client.messages = client_dictionary.get(cls.MESSAGES_KEY)
    client.session_id = client_dictionary.get(cls.SESSION_ID_KEY)
    return client

  def __str__(self):
    return '{%r, %d}' % (self.is_initiator, len(self.messages))
