# Copyright 2015 Google Inc. All Rights Reserved.

import unittest

import encryptor
import gcmrecord
from gcmrecord import GCMEncryptedRecord
from gcmrecord import GCMRecord

from google.appengine.datastore import datastore_stub_util
from google.appengine.ext import testbed


class GCMEncryptedRecordTest(unittest.TestCase):
  """Tests the GCMEncryptedRecord class in the gcmrecord module."""

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Create a consistency policy that will simulate the High Replication
    # consistency model.
    self.policy = datastore_stub_util.PseudoRandomHRConsistencyPolicy()
    # Initialize the datastore stub with this policy.
    self.testbed.init_datastore_v3_stub(consistency_policy=self.policy)
    self.testbed.init_memcache_stub()

  def testGetByUserKey(self):
    user_key = b'foo_user_key'
    record = GCMEncryptedRecord(parent=gcmrecord.get_ancestor_key(),
                                user_key=user_key)
    record.put()
    self.assertTrue(GCMEncryptedRecord.get_by_user_key(user_key))
    self.assertFalse(GCMEncryptedRecord.get_by_gcm_key(user_key))

  def testGetByGcmKey(self):
    gcm_key = b'bar_gcm_key'
    record = GCMEncryptedRecord(parent=gcmrecord.get_ancestor_key(),
                                gcm_key=gcm_key)
    record.put()
    self.assertTrue(GCMEncryptedRecord.get_by_gcm_key(gcm_key))
    self.assertFalse(GCMEncryptedRecord.get_by_user_key(gcm_key))


class GCMRecordTest(unittest.TestCase):
  """Tests the GCMRecord class in the gcmrecord module."""

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Create a consistency policy that will simulate the High Replication
    # consistency model.
    self.policy = datastore_stub_util.PseudoRandomHRConsistencyPolicy()
    # Initialize the datastore stub with this policy.
    self.testbed.init_datastore_v3_stub(consistency_policy=self.policy)
    self.testbed.init_memcache_stub()

    # Override AES key for testing.
    encryptor.AES_KEY = 'a' * 16
    encryptor.HASH_SALT = 'a' * 16

  def GetTestRecords(self):
    record_data = [('foo_user_id', 'foo_gcm_id', 'foo_code', 0, True, 0),
                   ('foo_user_id', 'foo_gcm_id', 'foo_code', 0, True, 1),
                   ('foo_user_id', 'foo_gcm_id', 'foo_code', 0, False, 0),
                   ('foo_user_id', 'foo_gcm_id', 'foo_code', 0, False, 1),

                   ('foo_user_id', 'foo_gcm_id', 'foo_code', 1, True, 0),
                   ('foo_user_id', 'foo_gcm_id', 'foo_code', 1, True, 1),
                   ('foo_user_id', 'foo_gcm_id', 'foo_code', 1, False, 0),
                   ('foo_user_id', 'foo_gcm_id', 'foo_code', 1, False, 1),

                   ('foo_user_id', 'foo_gcm_id', '', 0, True, 0),
                   ('foo_user_id', 'foo_gcm_id', '', 0, True, 1),
                   ('foo_user_id', 'foo_gcm_id', '', 0, False, 0),
                   ('foo_user_id', 'foo_gcm_id', '', 0, False, 1),

                   ('foo_user_id', 'foo_gcm_id', '', 1, True, 0),
                   ('foo_user_id', 'foo_gcm_id', '', 1, True, 1),
                   ('foo_user_id', 'foo_gcm_id', '', 1, False, 0),
                   ('foo_user_id', 'foo_gcm_id', '', 1, False, 1),

                   ('', '', '', 0, False, 0)]
    records = [GCMRecord(user_id=record_data[0],
                         gcm_id=record_data[1],
                         code=record_data[2],
                         code_sent_time=record_data[3],
                         verified=record_data[4],
                         last_modified_time=record_data[5])
               for record_data in record_data]
    return records

  def testJson(self):
    for record in self.GetTestRecords():
      record_json = record.get_json()
      parsed_record = GCMRecord.parse_json(record_json)
      self.assertEqual(record.user_id, parsed_record.user_id)
      self.assertEqual(record.gcm_id, parsed_record.gcm_id)
      self.assertEqual(record.code, parsed_record.code)
      self.assertEqual(record.code_sent_time, parsed_record.code_sent_time)
      self.assertEqual(record.verified, parsed_record.verified)
      self.assertEqual(record.last_modified_time,
                       parsed_record.last_modified_time)

  def testEncrypt(self):
    for record in self.GetTestRecords():
      record_json = record.get_json()
      encrypted_record = record.get_encrypted()
      self.assertNotEquals(record_json, encrypted_record)
      decrypted_record = GCMRecord.parse_encrypted(encrypted_record)
      decrypted_record_json = decrypted_record.get_json()
      self.assertEquals(record_json, decrypted_record_json)

  # TODO(tkchin): other tests for GCMRecord.

