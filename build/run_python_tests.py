#!/usr/bin/python

import os
import optparse
import sys
import unittest

USAGE = """%prog sdk_path test_path webtest_path
Run unit tests for App Engine apps.

sdk_path     Path to the SDK installation.
test_path    Path to package containing test modules.
webtest_path Path to the webtest library."""


def _WebTestIsInstalled():
  try:
    import webtest
    return True
  except ImportError:
    print 'You need to install webtest dependencies before you can proceed '
    print 'running the tests. To do this you need to get easy_install since '
    print 'that is how webtest provisions its dependencies.'
    print 'See https://pythonhosted.org/setuptools/easy_install.html.'
    print 'Then:'
    print 'cd webtest-master'
    print 'python setup.py install'
    print '(Prefix with sudo / run in admin shell as necessary).'
    return False


def main(sdk_path, test_path, webtest_path):
  if not os.path.exists(sdk_path):
    return 'Missing %s: try grunt shell:getPythonTestDeps.' % sdk_path
  if not os.path.exists(test_path):
    return 'Missing %s: try grunt build.' % test_path
  if not os.path.exists(webtest_path):
    return 'Missing %s: try grunt shell:getPythonTestDeps.' % webtest_path

  sys.path.insert(0, sdk_path)
  import dev_appserver
  dev_appserver.fix_sys_path()
  sys.path.append(webtest_path)
  if not _WebTestIsInstalled():
    return 1
  suite = unittest.loader.TestLoader().discover(test_path,
                                                pattern="*test.py")
  ok = unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()
  return 0 if ok else 1


if __name__ == '__main__':
  parser = optparse.OptionParser(USAGE)
  options, args = parser.parse_args()
  if len(args) != 3:
    parser.error('Error: Exactly 3 arguments required.')

  sdk_path, test_path, webtest_path = args[0:3]
  sys.exit(main(sdk_path, test_path, webtest_path))
