#!/usr/bin/python

"""Build App Engine source package.
"""

import json
import optparse
import os
import shutil
import subprocess
import sys

USAGE = """%prog SRC_PATH DEST_PATH
Build the GAE source code package.

SRC_PATH     Path to the source code root directory.
DEST_PATH    Path to the root directory to push/deploy GAE from."""


def call_cmd_and_return_output_lines(cmd):
  try:
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    output = process.communicate()[0]
    return output.split('\n')
  except OSError as e:
    print str(e)
    return []


def build_version_info_file(dest_path):
  """Build the version info JSON file."""
  version_info = {
      'gitHash': None,
      'time': None,
      'branch': None
  }

  lines = call_cmd_and_return_output_lines(['git', 'log', '-1'])
  for line in lines:
    if line.startswith('commit'):
      version_info['gitHash'] = line.partition(' ')[2].strip()
    elif line.startswith('Date'):
      version_info['time'] = line.partition(':')[2].strip()
    if version_info['gitHash'] is not None and version_info['time'] is not None:
      break

  lines = call_cmd_and_return_output_lines(['git', 'branch'])
  for line in lines:
    if line.startswith('*'):
      version_info['branch'] = line.partition(' ')[2].strip()
      break

  try:
    with open(dest_path, 'w') as f:
      f.write(json.dumps(version_info))
  except IOError as e:
    print str(e)


def main(src_path, dest_path):
  if os.path.exists(dest_path):
    shutil.rmtree(dest_path)
  os.makedirs(dest_path)

  simply_copy_subdirs = ['bigquery', 'css', 'images', 'third_party']

  for dirpath, unused_dirnames, files in os.walk(src_path):
    for subdir in simply_copy_subdirs:
      if dirpath.endswith(subdir):
        shutil.copytree(dirpath, os.path.join(dest_path, subdir))

    if dirpath.endswith('html'):
      dest_html_path = os.path.join(dest_path, 'html')
      os.makedirs(dest_html_path)
      for name in files:
        # Template files must be in the root directory.
        if name.endswith('_template.html'):
          shutil.copy(os.path.join(dirpath, name), dest_path)
        else:
          shutil.copy(os.path.join(dirpath, name), dest_html_path)
    elif dirpath.endswith('app_engine'):
      for name in files:
        if (name.endswith('.py') or name.endswith('.yaml')):
          shutil.copy(os.path.join(dirpath, name), dest_path)
    elif dirpath.endswith('js'):
      for name in files:
        # loopback.js is not compiled by Closure and needs to be copied
        # separately.
        if name == 'loopback.js':
          dest_js_path = os.path.join(dest_path, 'js')
          os.makedirs(dest_js_path)
          shutil.copy(os.path.join(dirpath, name), dest_js_path)
          break

  build_version_info_file(os.path.join(dest_path, 'version_info.json'))

if __name__ == '__main__':
  parser = optparse.OptionParser(USAGE)
  options, args = parser.parse_args()
  if len(args) != 2:
    print 'Error: Exactly 2 arguments required.'
    parser.print_help()
    sys.exit(1)

  SRC_PATH = args[0]
  DEST_PATH = args[1]
  main(SRC_PATH, DEST_PATH)
