#!/usr/bin/python

"""Copies and deletes tests."""

import os
import shutil


def _IsPythonTest(filename):
  return 'test' in filename and filename.endswith('.py')


def CopyTests(src_path, dest_path):
  if not os.path.exists(src_path):
    raise Exception('Failed to copy tests from %s; does not exist.' % src_path)

  for dirpath, _, files in os.walk(src_path):
    tests = [name for name in files if _IsPythonTest(name)]
    for test in tests:
      shutil.copy(os.path.join(dirpath, test), dest_path)


def RemoveTests(path):
  if not os.path.exists(path):
    raise Exception('Failed to remove tests from %s; does not exist.' % path)

  for dirpath, _, files in os.walk(path):
    tests = [name for name in files if _IsPythonTest(name)]
    for test in tests:
      to_remove = os.path.join(dirpath, test)
      print 'Removing %s.' % to_remove
      os.remove(to_remove)
