#!/usr/bin/python

import optparse
import os
import shutil
import sys

def main():
  parser = optparse.OptionParser("copy.py <src> <dest>")
  _, args = parser.parse_args()
  if len(args) != 2:
    parser.error('Error: Exactly 2 arguments required.')
  src, dest = args
  for fl in os.listdir(src):
    if fl.endswith('.js') and not 'test' in fl:
      shutil.copy(os.path.join(src, fl), os.path.join(dest, fl))


if __name__ == '__main__':
  sys.exit(main())
