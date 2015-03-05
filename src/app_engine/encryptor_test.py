# Copyright 2015 Google Inc. All Rights Reserved.

import logging
import time
import unittest

import encryptor
from encryptor import Encryptor
from encryptor import Hasher
from google.appengine.ext import testbed


class EncryptorTest(unittest.TestCase):
  """Tests the Encryptor class in the encryptor module."""

  def setUp(self):
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()

    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()

    # Override AES key for testing.
    encryptor.AES_KEY = 'a' * 16
    encryptor.HASH_SALT = 'a' * 16

  def testEncryptAndDecrypt(self):
    messages = ['show me the money',
                'whats mine is mine',
                'breathe deep',
                'something for nothing',
                'operation cwal',
                'modify the phase variance',
                'the gathering',
                'noglues',
                '',
                'x',
                'black sheep wall']
    for message in messages:
      encrypted_message = Encryptor.encrypt(message)
      self.assertNotEquals(message, encrypted_message)
      decrypted_message = Encryptor.decrypt(encrypted_message)
      self.assertEquals(message, decrypted_message)

  # Note: On dev machine this was on the order of 0.088ms for encrypt and
  # 0.029ms for decrypt. May be different on server.
  def testBenchmarkEncrypt(self):
    # Set level to INFO for this test to report timing.
    logger = logging.getLogger()
    old_logging_level = logger.getEffectiveLevel()
    logger.setLevel(logging.INFO)

    iters = 1000
    message = bytes('0123456789' * 100)
    start = time.time()
    encrypted_messages = [Encryptor.encrypt(message) for i in xrange(iters)]
    end = time.time()
    logging.info('Encrypt time: %f', (end - start) / len(encrypted_messages))
    start = time.time()
    decrypted_messages = [Encryptor.decrypt(encrypted_message)
                          for encrypted_message in encrypted_messages]
    end = time.time()
    logging.info('Decrypt time: %f', (end - start) / len(decrypted_messages))
    self.assertTrue(all(decrypted_message == message
                        for decrypted_message in decrypted_messages))

    # Restore level.
    logger.setLevel(old_logging_level)

  def testDigest(self):
    message = 'Power overwhelming.'
    encrypted_message = Encryptor.encrypt(message)
    # Tamper with message.
    encrypted_message = encrypted_message[:-1] + '!'
    decrypted_message = Encryptor.decrypt(encrypted_message)
    self.assertEquals(None, decrypted_message)

  def testSameContent(self):
    message = 'Show me the money.'
    encrypted_message1 = Encryptor.encrypt(message)
    encrypted_message2 = Encryptor.encrypt(message)
    self.assertNotEquals(encrypted_message1, encrypted_message2)

  def testHash(self):
    message = 'Baby you\'re my firework.'
    hashed_message1 = Hasher.salted_hash(message)
    hashed_message2 = Hasher.salted_hash(message)
    self.assertEquals(hashed_message1, hashed_message2)

  def testHashSalt(self):
    message = 'Don\'t stop believing.'
    hashed_message1 = Hasher.salted_hash(message)
    encryptor.HASH_SALT = 'b' * 16
    hashed_message2 = Hasher.salted_hash(message)
    self.assertNotEquals(hashed_message1, hashed_message2)
