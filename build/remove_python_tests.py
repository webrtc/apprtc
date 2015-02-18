#!/usr/bin/python

import optparse
import sys

import test_file_herder


def main():
  parser = optparse.OptionParser('Usage: %prog path_to_tests')
  _, args = parser.parse_args()
  if len(args) != 1:
    parser.error('Expected precisely one argument.')

  return test_file_herder.RemoveTests(args[0])

if __name__ == '__main__':
  sys.exit(main())
