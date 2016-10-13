#!/usr/bin/python

import os
import optparse
import sys
import unittest

USAGE = """%prog sdk_path test_path
Run unit tests for App Engine apps.

sdk_path     Path to the SDK installation.
test_path    Path to package containing test modules."""


def _WebTestIsInstalled():
  try:
    import webtest
    return True
  except ImportError:
    print 'You need to install webtest dependencies before you can proceed '
    print 'running the tests. To do this you need to have pip installed.'
    print 'Go to https://packaging.python.org/installing/ and follow the '
    print 'instructions and then rerun the grunt command.'
    return False


def main(sdk_path, test_path):
  if not os.path.exists(sdk_path):
    return 'Missing %s: try grunt shell:getPythonTestDeps.' % sdk_path
  if not os.path.exists(test_path):
    return 'Missing %s: try grunt build.' % test_path

  sys.path.insert(0, sdk_path)
  import dev_appserver
  dev_appserver.fix_sys_path()
  if not _WebTestIsInstalled():
    return 1
  suite = unittest.loader.TestLoader().discover(test_path,
                                                pattern="*test.py")
  ok = unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()
  return 0 if ok else 1


if __name__ == '__main__':
  parser = optparse.OptionParser(USAGE)
  options, args = parser.parse_args()
  if len(args) != 2:
    parser.error('Error: Exactly 2 arguments required.')

  sdk_path, test_path = args[0:2]
  sys.exit(main(sdk_path, test_path))
