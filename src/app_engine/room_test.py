# Copyright 2014 Google Inc. All Rights Reserved.

import unittest

import client as client_module
import room as room_module
from room import Room
from google.appengine.ext import testbed


class RoomTest(unittest.TestCase):

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

  def tearDown(self):
    self.testbed.deactivate()

  def GetTestClients(self):
    client_data = [(False, []), (False, ['foo']), (False, ['foo', 'bar']),
                   (True, []), (True, ['foo']), (True, ['foo', 'bar'])]
    clients = []
    for initiator, messages in client_data:
      client = client_module.Client(initiator)
      for message in messages:
        client.add_message(message)
      clients.append(client)
    return clients

  def GetTestRooms(self):
    clients = self.GetTestClients()
    open_type = Room.TYPE_OPEN
    dir_type = Room.TYPE_DIRECT
    room_data = [
        (open_type, []), (open_type, ['foo']), (open_type, ['foo', 'bar']),
        (dir_type, []), (dir_type, ['foo']), (dir_type, ['foo', 'bar'])]
    rooms = []
    def GetNextClient(i):
      client = clients[i]
      i = (i + 1) % len(clients)
      return (i, client)
    i = 0
    for room_type, allowed_clients in room_data:
      room = Room(room_type)
      for j in xrange(len(allowed_clients)):
        i, client = GetNextClient(i)
        room.add_client(str(i), client)
      for allowed_client in allowed_clients:
        room.add_allowed_client(allowed_client)
      rooms.append(room)
    return rooms

  def testAllowedClientList(self):
    room = room_module.Room(room_module.Room.TYPE_DIRECT)
    # If no allowed clients are specified, any ids are allowed.
    allowed = ['a', 'b', 'c', 'abc', '123']
    not_allowed = ['d', 'e', 'f', 'def', '456', '', None, {}, []]
    for item in not_allowed:
      self.assertEqual(True, room.is_client_allowed(item))

    for item in allowed:
      room.add_allowed_client(item)

    for item in allowed:
      self.assertEqual(True, room.is_client_allowed(item))

    for item in not_allowed:
      self.assertEqual(False, room.is_client_allowed(item))

  def testHasClientBySessionId(self):
    room = room_module.Room(room_module.Room.TYPE_OPEN)
    client1Id = 'client1'
    client2Id = 'client2'
    client1 = client_module.Client(True)
    client2 = client_module.Client(False)

    self.assertFalse(room.has_client_by_session_id(client1.session_id))
    self.assertFalse(room.has_client_by_session_id(client2.session_id))
    room.add_client(client1Id, client1)
    self.assertTrue(room.has_client_by_session_id(client1.session_id))
    self.assertFalse(room.has_client_by_session_id(client2.session_id))
    room.add_client(client2Id, client2)
    self.assertTrue(room.has_client_by_session_id(client1.session_id))
    self.assertTrue(room.has_client_by_session_id(client2.session_id))

  def testGetClientBySessionId(self):
    room = room_module.Room(room_module.Room.TYPE_OPEN)
    client1Id = 'client1'
    client2Id = 'client2'
    client1 = client_module.Client(True)
    client2 = client_module.Client(False)

    self.assertEqual(None, room.get_client_by_session_id(client1.session_id))
    self.assertEqual(None, room.get_client_by_session_id(client2.session_id))
    room.add_client(client1Id, client1)
    self.assertEqual(client1, room.get_client_by_session_id(client1.session_id))
    self.assertEqual(None, room.get_client_by_session_id(client2.session_id))
    room.add_client(client2Id, client2)
    self.assertEqual(client1, room.get_client_by_session_id(client1.session_id))
    self.assertEqual(client2, room.get_client_by_session_id(client2.session_id))

  def testGetClientIdBySessionId(self):
    room = room_module.Room(room_module.Room.TYPE_OPEN)
    client1Id = 'client1'
    client2Id = 'client2'
    client1 = client_module.Client(True)
    client2 = client_module.Client(False)

    self.assertEqual(None, room.get_client_id_by_session_id(client1.session_id))
    self.assertEqual(None, room.get_client_id_by_session_id(client2.session_id))
    room.add_client(client1Id, client1)
    self.assertEqual(client1Id,
                     room.get_client_id_by_session_id(client1.session_id))
    self.assertEqual(None, room.get_client_id_by_session_id(client2.session_id))
    room.add_client(client2Id, client2)
    self.assertEqual(client1Id,
                     room.get_client_id_by_session_id(client1.session_id))
    self.assertEqual(client2Id,
                     room.get_client_id_by_session_id(client2.session_id))

  def testJson(self):
    rooms = self.GetTestRooms()
    for room in rooms:
      room_json = room.get_json()
      parsed_room = Room.parse_json(room_json)
      self.assertEquals(room.room_type, parsed_room.room_type)
      self.assertEquals(room.allowed_clients, parsed_room.allowed_clients)
      for client_id, client in room.clients.items():
        self.assertTrue(client_id in parsed_room.clients)
        parsed_client = parsed_room.clients[client_id]
        self.assertEquals(client.messages, parsed_client.messages)
        self.assertEquals(client.is_initiator, parsed_client.is_initiator)
        self.assertEquals(client.session_id, parsed_client.session_id)

  def testEncrypt(self):
    rooms = self.GetTestRooms()
    for room in rooms:
      room_json = room.get_json()
      encrypted_room = room.get_encrypted()
      self.assertNotEquals(room_json, encrypted_room)
      decrypted_room = Room.parse_encrypted(encrypted_room)
      decrypted_room_json = decrypted_room.get_json()
      self.assertEquals(room_json, decrypted_room_json)

if __name__ == '__main__':
  unittest.main()
