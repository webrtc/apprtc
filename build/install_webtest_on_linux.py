#!/usr/bin/python

import optparse
import os
import sys


def InstallWebTestOnLinux(webtest_dir):
  cwd = os.getcwd()
  try:
    print 'About to install webtest into your system python.'
    os.chdir(webtest_dir)
    result = os.system('sudo python setup.py install')
    if result == 0:
      print 'Install successful.'
    else:
      return ('Failed to install webtest; are you missing setuptools / '
              'easy_install in your system python?')
  finally:
    os.chdir(cwd)


def main():
  parser = optparse.OptionParser('Usage: %prog webtest_path')
  _, args = parser.parse_args()
  if len(args) != 1:
    parser.error('Expected precisely one argument.')
  return InstallWebTestOnLinux(args[0])

if __name__ == '__main__':
  sys.exit(main())
