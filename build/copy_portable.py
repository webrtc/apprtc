#!/usr/bin/python

import optparse
import shutil
import sys


def main():
  parser = optparse.OptionParser("copy.py <src> <dest>")
  _, args = parser.parse_args()
  if len(args) != 2:
    parser.error('Error: Exactly 2 arguments required.')
  
  shutil.copy(args[0], args[1])

  
if __name__ == '__main__':
  sys.exit(main())
