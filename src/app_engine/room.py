#!/usr/bin/python2.4
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""Room model.

This module implements the room data model.
"""

import logging

import analytics
import client as client_module
import constants

from google.appengine.api import memcache


class Room(object):
  # Room used for simple named rooms, can be joined by knowing the room name.
  TYPE_OPEN = 1
  # Room used for direct calling, can only be joined by allowed clients.
  TYPE_DIRECT = 2

  STATE_EMPTY = 0
  STATE_WAITING = 1
  STATE_FULL = 2

  def __init__(self, room_type):
    self.clients = {}
    # The list of allowed clients will include the initiator and other
    # clients allowed to join the room. If no clients are added, no
    # list is enforced, and is_client_allowed will always return true.
    self.allowed_clients = None
    if room_type != Room.TYPE_OPEN and room_type != Room.TYPE_DIRECT:
      room_type = Room.TYPE_OPEN
    self.room_type = room_type

  def add_client(self, client_id, client):
    self.clients[client_id] = client

  def add_allowed_client(self, client_id):
    if self.allowed_clients is None:
      self.allowed_clients = []
    if client_id not in self.allowed_clients:
      self.allowed_clients.append(client_id)

  def remove_client(self, client_id):
    del self.clients[client_id]

  def get_occupancy(self):
    return len(self.clients)

  def has_client(self, client_id):
    return client_id in self.clients

  def has_client_by_session_id(self, client_session_id):
    return any(self.clients[client_key] is not None and
               self.clients[client_key].session_id == client_session_id
               for client_key in self.clients)

  def is_client_allowed(self, client_id):
    # If allowed_clients is None, don't enforce allowed_client list.
    return self.allowed_clients is None or client_id in self.allowed_clients

  def get_client(self, client_id):
    return self.clients[client_id]

  def get_client_by_session_id(self, client_session_id):
    for client_key in self.clients:
      client = self.clients[client_key]
      if client is not None and client.session_id == client_session_id:
        return client
    return None

  def get_client_id_by_session_id(self, client_session_id):
    for client_key in self.clients:
      client = self.clients[client_key]
      if client is not None and client.session_id == client_session_id:
        return client_key
    return None

  def get_other_client(self, client_id):
    for key, client in self.clients.items():
      if key is not client_id:
        return client
    return None

  def get_other_client_id(self, client_id):
    for other_id in self.clients:
      if other_id != client_id:
        return other_id
    return None

  def get_room_state(self):
    occupancy = self.get_occupancy()
    if occupancy == 0:
      return Room.STATE_EMPTY
    elif occupancy == 1:
      return Room.STATE_WAITING
    return Room.STATE_FULL

  def __str__(self):
    return str(self.clients.keys())


def get_memcache_key_for_room(host, room_id):
  return '%s/%s' % (host, room_id)


def has_room(host, room_id):
  key = get_memcache_key_for_room(host, room_id)
  memcache_client = memcache.Client()
  room = memcache_client.get(key)
  return room is not None


def get_room(host, room_id):
  key = get_memcache_key_for_room(host, room_id)
  memcache_client = memcache.Client()
  return memcache_client.get(key)


def get_room_state(host, room_id):
  room = get_room(host, room_id)
  if room is None:
    return None
  return room.get_room_state()


def remove_room_for_declined_call(host, room_id, callee_gcm_id):
  return remove_room_direct(host, room_id, callee_gcm_id, for_decline=True)


def remove_room_for_leave_call(host, room_id, client_gcm_id):
  return remove_room_direct(host, room_id, client_gcm_id, for_decline=False)


def remove_room_direct(host, room_id, client_gcm_id, for_decline):
  memcache_client = memcache.Client()
  key = get_memcache_key_for_room(host, room_id)

  for retries in xrange(constants.ROOM_MEMCACHE_RETRY_LIMIT):
    room = memcache_client.gets(key)

    if room is None:
      logging.warning('Can\'t remove room ' + room_id +
                      ' because it doesn\'t exist, client: ' + client_gcm_id)
      return (constants.RESPONSE_INVALID_ROOM, room)

    if not room.is_client_allowed(client_gcm_id):
      logging.warning('Can\'t remove room ' + room_id +
                      ' because room does not allow client ' + client_gcm_id)
      if for_decline:
        result = constants.RESPONSE_INVALID_CALLEE
      else:
        result = constants.RESPONSE_INVALID_USER
      return (result, room)

    if room.room_type != Room.TYPE_DIRECT:
      logging.warning('Can\'t remove room ' + room_id +
                      ' because it has type: ' + str(room.room_type) +
                      ' client: ' + client_gcm_id)
      return (constants.RESPONSE_INVALID_ROOM, room)

    if for_decline:
      if room.get_room_state() == Room.STATE_FULL:
        logging.warning('Can\'t remove room ' + room_id +
                        'because it is full (' + str(room.get_occupancy()) +
                        ') client: ' + client_gcm_id)
        return (constants.RESPONSE_INVALID_ROOM, room)
      # If the room is not full, the client already in the room is the caller.
      # The caller should not be removing the room via decline.
      if room.has_client(client_gcm_id):
        logging.warning('Can\'t remove room ' + room_id +
                        ' because client is caller: ' + client_gcm_id)
        return (constants.RESPONSE_INVALID_CALLEE, room)
    else:
      # Be sure the user is in the room.
      if not room.has_client(client_gcm_id):
        logging.warning('Can\'t remove room ' + room_id +
                        ' because user is not in the room. Client: ' + client_gcm_id)
        return (constants.RESPONSE_INVALID_USER, room)

    # Reset the room to the initial state so it may be reused.
    reset_room = Room(room.room_type)
    if memcache_client.cas(key, reset_room,
                           constants.ROOM_MEMCACHE_EXPIRATION_SEC):
      logging.info('Reset room %s to base state in remove_room by'
                   ' client %s, retries = %d',
                   room_id, client_gcm_id, retries)
      other_client_id = room.get_other_client_id(client_gcm_id)
      return (constants.RESPONSE_SUCCESS, room)

  logging.warning('Failed to remove room ' + room_id + ' after retry limit '
                  ' client: ' + client_gcm_id)
  return (constants.RESPONSE_INTERNAL_ERROR, None)


def add_client_to_room(request, room_id, client_id,
                       is_loopback, room_type, allow_room_creation,
                       allowed_clients=None):

  key = get_memcache_key_for_room(request.host_url, room_id)
  memcache_client = memcache.Client()
  error = None
  room = None
  client = None
  # Compare and set retry loop.
  for retries in xrange(constants.ROOM_MEMCACHE_RETRY_LIMIT):
    is_initiator = None
    messages = []
    room = memcache_client.gets(key)
    if room is None:
      if allow_room_creation:
        # 'set' and another 'gets' are needed for CAS to work.
        if not memcache_client.set(key, Room(room_type)):
          logging.warning('memcache.Client.set failed for key ' + key)
          error = constants.RESPONSE_INTERNAL_ERROR
          break
        room = memcache_client.gets(key)
      else:
        logging.warning('Room did not exist and room creation is not '
                        ' allowed. room_id: ' + room_id + ' client: ' +
                        client_id)
        error = constants.RESPONSE_INVALID_ROOM
        break

    occupancy = room.get_occupancy()
    if occupancy >= 2:
      error = constants.RESPONSE_ROOM_FULL
      break
    if room.has_client(client_id):
      error = constants.RESPONSE_DUPLICATE_CLIENT
      break

    if room.room_type != room_type:
      logging.warning('Room type did not match while adding client ' +
                      client_id + ' to room ' + room_id + ' room type is ' +
                      str(room.room_type) + ' requested room type is ' +
                      str(room_type))
      error = constants.RESPONSE_INVALID_ROOM
      break

    if occupancy == 0:
      is_initiator = True
      client = client_module.Client(is_initiator)
      room.add_client(client_id, client)
      if is_loopback:
        room.add_client(constants.LOOPBACK_CLIENT_ID,
                        client_module.Client(False))
      if allowed_clients is not None:
        for allowed_client in allowed_clients:
          room.add_allowed_client(allowed_client)
    else:
      is_initiator = False
      other_client = room.get_other_client(client_id)
      messages = other_client.messages
      client = client_module.Client(is_initiator)
      room.add_client(client_id, client)
      other_client.clear_messages()
      # Check if the callee was the callee intended by the caller.
      if not room.is_client_allowed(client_id):
        logging.warning('Client ' + client_id + ' not allowed in room ' +
                        room_id + ' allowed clients: ' +
                        ','.join(room.allowed_clients))
        error = constants.RESPONSE_INVALID_ROOM
        break

    if memcache_client.cas(key, room, constants.ROOM_MEMCACHE_EXPIRATION_SEC):
      logging.info('Added client %s in room %s, retries = %d',
                   client_id, room_id, retries)

      if room.get_occupancy() == 2:
        analytics.report_event(analytics.EventType.ROOM_SIZE_2,
                               room_id,
                               host=request.host)
      break
  client_session_id = None
  if client is not None:
    client_session_id = client.session_id
  return {'error': error, 'is_initiator': is_initiator,
          'messages': messages, 'room_state': str(room),
          'session_id': client_session_id}


def remove_client_from_open_room(host, room_id, client_session_id):
  key = get_memcache_key_for_room(host, room_id)
  memcache_client = memcache.Client()
  # Compare and set retry loop.
  for retries in xrange(constants.ROOM_MEMCACHE_RETRY_LIMIT):
    room = memcache_client.gets(key)
    if room is None:
      logging.warning('remove_client_from_room: Unknown room ' + room_id)
      return {'error': constants.RESPONSE_INVALID_ROOM, 'room_state': None}
    if not room.has_client_by_session_id(client_session_id):
      logging.warning('remove_client_from_room: Unknown client ' +
                      client_session_id + ' for room ' + room_id)
      return {'error': constants.RESPONSE_INVALID_USER, 'room_state': None}

    if room.room_type != Room.TYPE_OPEN:
      logging.warning('remove_client_from_open_room: Room is not TYPE_OPEN ' +
                      room_id + ' room type: ' + str(room.room_type))
      return {'error': constants.RESPONSE_INVALID_ROOM, 'room_state': str(room)}

    client_id = room.get_client_id_by_session_id(client_session_id)
    room.remove_client(client_id)
    if room.has_client(constants.LOOPBACK_CLIENT_ID):
      room.remove_client(constants.LOOPBACK_CLIENT_ID)
    if room.get_occupancy() > 0:
      room.get_other_client(client_id).set_initiator(True)
    else:
      room = None

    if memcache_client.cas(key, room, constants.ROOM_MEMCACHE_EXPIRATION_SEC):
      logging.info('Removed client %s from room %s, retries=%d',
                   client_id, room_id, retries)
      return {'error': None, 'room_state': str(room)}
  return {'error': constants.RESPONSE_INTERNAL_ERROR, 'room_state': None}


def save_message_from_client(host, room_id, client_session_id, message):
  text = None
  try:
    text = message.encode(encoding='utf-8', errors='strict')
  except Exception:
    return {'error': constants.RESPONSE_INVALID_ARGUMENT, 'saved': False}

  key = get_memcache_key_for_room(host, room_id)
  memcache_client = memcache.Client()
  # Compare and set retry loop.
  for retries in xrange(constants.ROOM_MEMCACHE_RETRY_LIMIT):
    room = memcache_client.gets(key)
    if room is None:
      logging.warning('Unknown room: ' + room_id)
      return {'error': constants.RESPONSE_UNKNOWN_ROOM, 'saved': False}
    if not room.has_client_by_session_id(client_session_id):
      logging.warning('Unknown client: ' + client_session_id)
      return {'error': constants.RESPONSE_INVALID_USER, 'saved': False}
    if room.get_occupancy() > 1:
      return {'error': None, 'saved': False}

    client = room.get_client_by_session_id(client_session_id)
    client.add_message(text)
    if memcache_client.cas(key, room, constants.ROOM_MEMCACHE_EXPIRATION_SEC):
      logging.info('Saved message for client %s:%s in room %s, retries=%d',
                   client_session_id, str(client), room_id, retries)
      return {'error': None, 'saved': True}
  return {'error': constants.RESPONSE_INTERNAL_ERROR, 'saved': False}

