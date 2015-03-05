"""AES Encryption module.
"""

import logging
import struct

from Crypto import Random
from Crypto.Cipher import AES
from Crypto.Hash import SHA256

import constants
import util

AES_KEY = None
AES_KEY_PATH = 'gae_aes_key'
HASH_SALT = None
HASH_SALT_PATH = 'gae_hash_salt'


def get_aes_key():
  """Reads the AES key from disk."""
  global AES_KEY
  if AES_KEY is not None:
    return AES_KEY
  if not util.file_exists(AES_KEY_PATH):
    if not constants.IS_DEV_SERVER:
      logging.error('Missing AES key file.')
    return None
  key = util.read_file_contents(AES_KEY_PATH)
  if key is None or len(key) not in AES.key_size:
    logging.error('Failed to load AES key.')
  else:
    AES_KEY = key
  return AES_KEY


def get_hash_salt():
  """Reads the hash salt from disk."""
  global HASH_SALT
  if HASH_SALT is not None:
    return HASH_SALT
  if not util.file_exists(HASH_SALT_PATH):
    if not constants.IS_DEV_SERVER:
      logging.error('Missing hash salt file.')
    return None
  salt = util.read_file_contents(HASH_SALT_PATH)
  if salt is None:
    logging.error('Failed to load hash salt.')
  else:
    HASH_SALT = salt
  return HASH_SALT


class Encryptor(object):
  """Convenience class used to encrypt, decrypt and verify a message string.
  """

  @classmethod
  def encrypt(cls, message):
    """Encrypts and signs message.

    Encrypted message has the following format:
    iv + encrypt(digest + message_length + message + padding)
    where digest is SHA256(message_length + message + padding).
    Padding is required because AES required 16-byte aligned content.

    Args:
      message: A message string.

    Returns:
      An encrypted and signed byte string.
    """
    key = get_aes_key()
    if key is None:
      if constants.IS_DEV_SERVER:
        # If no key specified on local server return plaintext.
        return message
      else:
        logging.error('No encryption key, not encrypting.')
        return None

    # Create random 16-byte initialization vector.
    iv = Random.new().read(AES.block_size)
    cipher = AES.new(key, AES.MODE_CBC, iv)

    # Content is message prefixed with message length.
    content = struct.pack('>q', len(message)) + message

    # Pad the content to be a multiple of 16 bytes.
    padding_length = AES.block_size - (len(content) % AES.block_size)
    padded_content = content + (chr(padding_length) * padding_length)

    # Generate digest.
    hmac = SHA256.new()
    hmac.update(padded_content)
    digest = hmac.digest()

    # Create ciphertext by encrypting with AES.
    cipher_text = cipher.encrypt(digest + padded_content)

    return iv + cipher_text

  @classmethod
  def decrypt(cls, encrypted_string):
    """Decrypts a byte string returned by Encryptor.encrypt.

    Args:
      encrypted_string: A byte string returned by Encryptor.encrypt.

    Returns:
      Decrypted byte string.
    """
    key = get_aes_key()
    if key is None:
      if constants.IS_DEV_SERVER:
        # If no key specified on local server string is already plaintext.
        return encrypted_string
      else:
        logging.error('No encryption key, not decrypting.')
        return None

    if len(encrypted_string) < AES.block_size:
      logging.error('Bad encrypted string length.')
      return None

    # Extract initialization vector and message length from header.
    iv = encrypted_string[:AES.block_size]

    # Decrypt.
    cipher = AES.new(key, AES.MODE_CBC, iv)
    plain_text = cipher.decrypt(encrypted_string[AES.block_size:])

    # Read digest.
    if len(plain_text) < SHA256.digest_size:
      logging.error('Bad digest length.')
      return None
    digest = plain_text[:SHA256.digest_size]
    hmac = SHA256.new()
    hmac.update(plain_text[SHA256.digest_size:])
    if digest != hmac.digest():
      logging.error('Digests don\'t match!')
      return None

    # Read message length.
    message_length_index = SHA256.digest_size + struct.calcsize('>q')
    if len(plain_text) < message_length_index:
      logging.error('Bad content length.')
      return None
    (message_length,) = struct.unpack(
        '>q', plain_text[SHA256.digest_size:message_length_index])

    # Read padded message.
    padded_message = plain_text[message_length_index:]
    if len(padded_message) < message_length:
      logging.error('Bad content length.')
      return None
    message = padded_message[:message_length]

    return message


class Hasher(object):
  """Convenience class to generate SHA256 hashes using a global salt."""

  @classmethod
  def salted_hash(cls, message):
    salt = get_hash_salt()
    if salt is None:
      if not constants.IS_DEV_SERVER:
        logging.error('No hash salt, not hashing!')
        return None
      else:
        salt = b''
    hmac = SHA256.new()
    hmac.update(salt + message)
    return hmac.digest()
