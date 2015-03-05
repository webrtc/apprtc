# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC utility methods.

This module implements utility methods shared between other modules.
"""

import collections
import json
import logging
import os
import random


def has_msg_field(msg, field, field_type):
  """Checks that field is present in message with the right type.

  Args:
    msg: message dictionary
    field: key in dictionary
    field_type: type of value in dictionary

  Returns:
  True if key exists and its value is of type |field_type| and
  non-empty if it is an Iterable.
  """
  return msg is not None and field in msg and \
      isinstance(msg[field], field_type) and \
      (not isinstance(msg[field], collections.Iterable) or \
       len(msg[field]) > 0)


def has_msg_fields(msg, fields):
  """Checks that the fields are present in message with the right types.

  Args:
    msg: message dictionary
    fields: tuples of (field, field_type)

  Returns:
  True if all keys exist and their values are non-empty if they are Iterable.
  """
  return reduce(lambda x, y: x and y,
                [has_msg_field(msg, field, field_type)
                 for field, field_type in fields])


def get_message_from_json(body):
  """Parses JSON from request body.

  Args:
    body: request body string

  Returns:
  Parsed JSON object if JSON is valid and the represented object is a
  dictionary, otherwise returns None.
  """
  try:
    message = json.loads(body)
    if isinstance(message, dict):
      return message
    logging.warning('Expected dictionary message, request=%s', body)
    return None
  except Exception as e:
    logging.warning('JSON load error=%s, request=%s', str(e), body)
    return None


def generate_random(length):
  word = ''
  for _ in range(length):
    word += random.choice('0123456789')
  return word


def file_exists(file_name):
  return os.path.isfile(os.path.join(os.path.dirname(__file__), file_name))


def read_file_contents(file_name):
  """Reads contents of file at path and returns it."""
  try:
    path = os.path.join(os.path.dirname(__file__), file_name)
    contents = None
    with open(path, 'r') as f:
      contents = f.read()
    if not contents:
      logging.error('Empty file at %s', path)
      return None
    return contents
  except IOError:
    logging.error('Failed to open file at %s', path)
    return None
