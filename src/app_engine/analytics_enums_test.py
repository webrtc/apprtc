# Copyright 2014 Google Inc. All Rights Reserved.

import unittest

from analytics_enums import BigquerySchemaClass
from analytics_enums import EnumClass


class AnalyticsEnumsTest(unittest.TestCase):
  """Test the EnumClass behaves as expected."""

  def testEnumClass(self):
    value_dict = {
        'FOO': 10,
        'BAR': 42,
        'BAZ': 'test',
        'SubEnum': {
            'BIM': 'bang',
            'BEN': 'boom',
        }}

    my_enum = EnumClass(value_dict)

    self.assertEqual(value_dict['FOO'], my_enum.FOO)
    self.assertEqual(value_dict['BAR'], my_enum.BAR)
    self.assertEqual(value_dict['BAZ'], my_enum.BAZ)
    self.assertEqual(value_dict['SubEnum']['BIM'], my_enum.SubEnum.BIM)
    self.assertEqual(value_dict['SubEnum']['BEN'], my_enum.SubEnum.BEN)
    self.assertTrue(isinstance(my_enum.SubEnum, EnumClass))

  def testBigquerySchemaClass(self):
    field1 = 'field1'
    field2 = 'field2'
    schema_dict = [
        {
            'name': 'field1',
            'type': 'string',
            'mode': 'nullable'
        },
        {
            'name': 'field2',
            'type': 'timestamp',
            'mode': 'nullable'
        },
    ]

    my_enum = BigquerySchemaClass(schema_dict)

    self.assertEqual(field1, my_enum.FIELD1)
    self.assertEqual(field2, my_enum.FIELD2)
