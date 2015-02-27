#!/usr/bin/python2.4
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""Client model.

This module implements the client data model.
"""

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

  def __str__(self):
    return '{%r, %d}' % (self.is_initiator, len(self.messages))
