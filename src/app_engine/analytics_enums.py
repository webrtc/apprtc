# Copyright 2015 Google Inc. All Rights Reserved.

"""Module for all the analytics enums.

Analytics enums are separated out to this module so that they can be
loaded from build scripts. Loading the analytics or analytics_page
module requires appengine and Google API python libraries. This module
requires only python standard library modules.

"""

import json
import os


class EnumClass(object):
  """Type for loading enums from a JSON file.

  Builds an object instance from a dictionary where keys are
  attributes and sub-dictionaries are additional instances of this
  class. It is intended to be used for building objects to hold enums.

  A dictionary of the form,

  {
    'ENUM1': 5,
    'SubEnum': {
      'SUBENUM1': 10
    }
  }

  will be loaded as an instance where,

  instance.ENUM1 == 5
  instance.SubEnum.SUBENUM1 == 10
  """

  def __init__(self, enum_dict):
    reverse = {}
    for key, val in enum_dict.iteritems():
      if isinstance(val, dict):
        # Make a new class and populate its values.
        setattr(self, key, EnumClass(val))
      else:
        setattr(self, key, val)
        reverse[val] = key

    setattr(self, 'Name', reverse)


ENUMS = json.load(open(os.path.join(os.path.dirname(__file__),
                                                  'bigquery',
                                                  'enums.json')))
EventType = EnumClass(ENUMS['EventType'])
RequestField = EnumClass(ENUMS['RequestField'])
ClientType = EnumClass(ENUMS['ClientType'])


class BigquerySchemaClass(object):
  """Metaclass for loading the bigquery schema from JSON."""

  def __init__(self, schema_dict):
    for field in schema_dict:
      setattr(self, field['name'].upper(), field['name'])

LogField = BigquerySchemaClass(
    json.load(open(os.path.join(os.path.dirname(__file__),
                                'bigquery',
                                'analytics_schema.json'))))
