#!/usr/bin/python2.7
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""Database model for AppRTC registration.

GCMEncryptedRecord is the stored ndb model.
GCMRecord is the decrypted version of the stored model which contains sensitive
information that we can't store in plaintext. These exist in memory only.

Some notes:
- We need userId and gcmId as keys to look up associated records. These are
  hashed so that they are not directly readable from db.

- Database is vulnerable to rainbow attack if global salt is known. This will
  expose user ids since phone numbers are easily iterable. Also, clearly db
  is vulnerable if encryption key is known.

- Also note that hashing gcmId to be used as a lookup key is not good since now
  the encryption we use is only as good as the salt. However, in order to change
  this we'd need to change the call APIs to provide both userId and gcmId where
  they now take gcmId. In that model we would make all queries off the hashed
  userId, and decrypt gcmId as needed. Potential future work.
"""

import json
import logging
import time

import constants
from encryptor import Encryptor
from encryptor import Hasher

from google.appengine.ext import ndb


def get_ancestor_key():
  return ndb.Key('GCMEncryptedRecord', 'global')


class GCMEncryptedRecord(ndb.Model):
  """Stores an encrypted registration in db."""
  # SHA256 hash of user_id.
  user_key = ndb.BlobProperty(indexed=True)
  # SHA256 hash of gcm_id.
  gcm_key = ndb.BlobProperty(indexed=True)
  # AES-encrypted JSON representation of a GCMRecord.
  content = ndb.BlobProperty()

  @classmethod
  def get_by_user_key(cls, user_key):
    q = GCMEncryptedRecord.query(ancestor=get_ancestor_key())
    q = q.filter(GCMEncryptedRecord.user_key == user_key)
    return q.fetch()

  @classmethod
  def get_by_gcm_key(cls, gcm_key):
    q = GCMEncryptedRecord.query(ancestor=get_ancestor_key())
    q = q.filter(GCMEncryptedRecord.gcm_key == gcm_key)
    return q.fetch()


class GCMRecord(object):
  """Encapsulates registration information for a userId and gcmId pair."""
  USER_ID_KEY = 'user_id'
  GCM_ID_KEY = 'gcm_id'
  CODE_KEY = 'code'
  CODE_SENT_TIME_KEY = 'code_sent_time'
  VERIFIED_KEY = 'verified'
  LAST_MODIFIED_TIME_KEY = 'last_modified_time'

  def __init__(self, user_id='', gcm_id='', code='', code_sent_time=0,
               verified=False, last_modified_time=0):
    self.user_id = user_id
    self.gcm_id = gcm_id
    self.code = code
    self.code_sent_time = code_sent_time
    self.verified = verified
    self.last_modified_time = last_modified_time

  def get_json(self):
    """Returns the JSON representation of this record."""
    content_dictionary = {
        GCMRecord.USER_ID_KEY: self.user_id,
        GCMRecord.GCM_ID_KEY: self.gcm_id,
        GCMRecord.CODE_KEY: self.code,
        GCMRecord.CODE_SENT_TIME_KEY: self.code_sent_time,
        GCMRecord.VERIFIED_KEY: self.verified,
        GCMRecord.LAST_MODIFIED_TIME_KEY: self.last_modified_time
    }
    return json.dumps(content_dictionary)

  @classmethod
  def parse_json(cls, json_string):
    """Inflates a GCMRecord from the JSON."""
    try:
      content_dictionary = json.loads(json_string)
      required_keys = [
          cls.USER_ID_KEY, cls.GCM_ID_KEY, cls.CODE_KEY, cls.CODE_SENT_TIME_KEY,
          cls.VERIFIED_KEY, cls.LAST_MODIFIED_TIME_KEY
      ]
      if not all([key in content_dictionary for key in required_keys]):
        logging.error('GCMRecord JSON missing required fields.')
        return None
    except ValueError as e:
      logging.error('Bad JSON string. Error:%s', str(e))
      return None
    record = GCMRecord()
    record.user_id = content_dictionary[cls.USER_ID_KEY]
    record.gcm_id = content_dictionary[cls.GCM_ID_KEY]
    record.code = content_dictionary[cls.CODE_KEY]
    record.code_sent_time = content_dictionary[cls.CODE_SENT_TIME_KEY]
    record.verified = content_dictionary[cls.VERIFIED_KEY]
    record.last_modified_time = content_dictionary[cls.LAST_MODIFIED_TIME_KEY]
    return record

  def get_encrypted(self):
    """Returns an encrypted string representing this record."""
    return Encryptor.encrypt(self.get_json())

  @classmethod
  def parse_encrypted(cls, encrypted_content):
    """Inflates a GCMRecord from previously generated encrypted content."""
    return cls.parse_json(Encryptor.decrypt(encrypted_content))

  @classmethod
  def get_by_user_id(cls, user_id, verified_only=False):
    """Retrieves records with the given user_id."""
    user_key = Hasher.salted_hash(user_id)
    encrypted_records = GCMEncryptedRecord.get_by_user_key(user_key)
    result = []
    for encrypted_record in encrypted_records:
      record = GCMRecord.parse_encrypted(encrypted_record.content)
      if record and ((not verified_only) or record.verified):
        result.append(record)
    return result

  @classmethod
  def get_by_gcm_id(cls, gcm_id, verified_only=False):
    """Retrieves the record with the given gcm_id."""
    gcm_key = Hasher.salted_hash(gcm_id)
    encrypted_records = GCMEncryptedRecord.get_by_gcm_key(gcm_key)
    result = []
    for encrypted_record in encrypted_records:
      record = GCMRecord.parse_encrypted(encrypted_record.content)
      if record and ((not verified_only) or record.verified):
        result.append(record)
    # GCM ids should be unique.
    num_records = len(result)
    if num_records > 1:
      logging.error('Multiple records with the same GCM ID!')
    return None if num_records == 0 else result[0]

  @classmethod
  def get_user_id_for_gcm_id(cls, gcm_id, verified_only=False):
    """Retrieves the user_id for the record with the given gcm_id."""
    record = cls.get_by_gcm_id(gcm_id, verified_only)
    if record:
      return record.user_id
    return None

  @classmethod
  def get_associated_records_for_gcm_id(cls, gcm_id, verified_only=False):
    """Returns records which share the same user_id as the one with the gcm_id.

       The record matching the gcm_id is retrieved, followed by the records
       which share the same user_id as that record. All of these are returned.

    Args:
       gcm_id: GCM id string.
       verified_only: Bool for whether or not to only return verified records.
    Returns:
       list of GCMRecord
    """
    user_id = cls.get_user_id_for_gcm_id(gcm_id, verified_only)
    if user_id is None:
      return []
    return cls.get_by_user_id(user_id, verified_only)

  @classmethod
  @ndb.transactional(retries=100)
  def add_or_update(cls, user_id, gcm_id, code):
    """Creates a new record in the store or updates it."""
    user_key = Hasher.salted_hash(user_id)
    gcm_key = Hasher.salted_hash(gcm_id)
    encrypted_records = GCMEncryptedRecord.get_by_gcm_key(gcm_key)
    now = time.time()
    if not encrypted_records:
      record = GCMRecord(user_id=user_id,
                         gcm_id=gcm_id,
                         code=code,
                         verified=False,
                         code_sent_time=now,
                         last_modified_time=now)
      encrypted_record = GCMEncryptedRecord(
          parent=get_ancestor_key(),
          user_key=user_key,
          gcm_key=gcm_key,
          content=record.get_encrypted())
      encrypted_record.put()
      logging.info('GCM binding added, user_id=%s, gcm_id=%s', user_id, gcm_id)
      return constants.RESPONSE_CODE_SENT

    assert len(encrypted_records) == 1
    encrypted_record = encrypted_records[0]
    record = GCMRecord.parse_encrypted(encrypted_record.content)
    if not record:
      logging.error('Error parsing encrypted record for gcm_id:%s', gcm_id)
      return constants.RESPONSE_INTERNAL_ERROR
    if record.verified:
      logging.warning('Cannot update GCM binding code since already verified, '
                      'user_id=%s, gcm_id=%s', user_id, gcm_id)
      return constants.RESPONSE_INVALID_STATE

    record.code = code
    record.code_sent_time = now
    record.last_modified_time = now
    encrypted_record.content = record.get_encrypted()
    encrypted_record.put()
    logging.info(
        'GCM binding code updated, user_id=%s, gcm_id=%s', user_id, gcm_id)
    return constants.RESPONSE_CODE_RESENT

  @classmethod
  @ndb.transactional(retries=100)
  def verify(cls, user_id, gcm_id, code):
    """Marks the registration as verified if the supplied code matches."""
    gcm_key = Hasher.salted_hash(gcm_id)
    encrypted_records = GCMEncryptedRecord.get_by_gcm_key(gcm_key)
    assert len(encrypted_records) < 2
    if not encrypted_records:
      logging.error('GCM binding not found, user_id=%s', user_id)
      return constants.RESPONSE_NOT_FOUND

    encrypted_record = encrypted_records[0]
    record = GCMRecord.parse_encrypted(encrypted_record.content)
    if not record:
      logging.error('Error parsing encrypted record for gcm_id:%s', gcm_id)
      return constants.RESPONSE_INTERNAL_ERROR
    if record.verified:
      logging.warning('GCM binding already verified, user_id=%s, gcm_id=%s',
                      user_id, gcm_id)
      return constants.RESPONSE_INVALID_STATE
    if record.code == code:
      record.verified = True
      record.last_modified_time = time.time()
      encrypted_record.content = record.get_encrypted()
      encrypted_record.put()
      logging.info(
          'GCM binding verified, user_id=%s, gcm_id=%s', user_id, gcm_id)
      return constants.RESPONSE_SUCCESS
    else:
      return constants.RESPONSE_INVALID_CODE

  @classmethod
  @ndb.transactional(retries=100)
  def remove(cls, user_id, gcm_id):
    """Removes the registration from the store."""
    gcm_key = Hasher.salted_hash(gcm_id)
    encrypted_records = GCMEncryptedRecord.get_by_gcm_key(gcm_key)
    assert len(encrypted_records) < 2
    if not encrypted_records:
      logging.warning('GCM binding not found, user_id=%s', user_id)
      return
    encrypted_record = encrypted_records[0]
    encrypted_record.key.delete()
    logging.info('GCM binding deleted, user_id=%s, gcm_id=%s', user_id, gcm_id)

  @classmethod
  @ndb.transactional(retries=100)
  def update_gcm_id(cls, user_id, old_gcm_id, new_gcm_id):
    """Updates the registration with a new GCM id."""
    old_gcm_key = Hasher.salted_hash(old_gcm_id)
    encrypted_records = GCMEncryptedRecord.get_by_gcm_key(old_gcm_key)
    assert len(encrypted_records) < 2
    if not encrypted_records:
      logging.error('GCM binding not found, user_id=%s', user_id)
      return constants.RESPONSE_NOT_FOUND

    encrypted_record = encrypted_records[0]
    record = GCMRecord.parse_encrypted(encrypted_record.content)
    if not record:
      logging.error('Error parsing encrypted record for gcm_id:%s', old_gcm_id)
      return constants.RESPONSE_INTERNAL_ERROR
    if record.verified:
      record.gcm_id = new_gcm_id
      record.last_modified_time = time.time()
      encrypted_record.content = record.get_encrypted()
      new_gcm_key = Hasher.salted_hash(new_gcm_id)
      encrypted_record.gcm_key = new_gcm_key
      encrypted_record.put()
      logging.info(
          'GCM binding updated, user_id=%s, old_gcm_id=%s, new_gcm_id=%s',
          user_id, old_gcm_id, new_gcm_id)
      return constants.RESPONSE_SUCCESS
    else:
      logging.warning('Cannot update unverified GCM binding, '
                      'user_id=%s, old_gcm_id=%s, new_gcm_id=%s',
                      user_id, old_gcm_id, new_gcm_id)
      return constants.RESPONSE_INVALID_STATE
