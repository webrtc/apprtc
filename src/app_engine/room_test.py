# Copyright 2014 Google Inc. All Rights Reserved.

import unittest

import client as client_module
import room as room_module
from google.appengine.ext import testbed


class RoomUnitTest(unittest.TestCase):

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

  def tearDown(self):
    self.testbed.deactivate()

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

if __name__ == '__main__':
  unittest.main()
