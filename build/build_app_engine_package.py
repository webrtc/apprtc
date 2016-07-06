#!/usr/bin/python

"""Build App Engine source package.
"""

import json
import optparse
import os
import shutil
import subprocess
import sys
import requests

import test_file_herder

USAGE = """%prog src_path dest_path
Build the GAE source code package.

src_path     Path to the source code root directory.
dest_path    Path to the root directory to push/deploy GAE from."""


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


# Download callstats, copy dependencies from node_modules for serving as
# static content on GAE.
def downloadCallstats():
  print 'Downloading and copying callstats dependencies...'
  path = 'out/app_engine/third_party/callstats/'
  if os.path.exists(path):
    shutil.rmtree(path)
  os.makedirs(path)

  urls =  {
    'callstats.min.js': 'https://api.callstats.io/static/callstats.min.js',
    'sha.js': 'https://cdnjs.cloudflare.com/ajax/libs/jsSHA/1.5.0/sha.js'
  }

  for fileName in urls:
    response = requests.get(urls[fileName])
    if response.status_code == 200:
      print 'Downloading %s to %s...' % (urls[fileName], path)
      with open(path + fileName, 'w') as to_file:
        to_file.write(response.text)
    else:
      raise NameError('Could not download: ' + filename + ' Error:' + \
        str(response.status_code))

  # Need to copy this from node_modules due to https://cdn.socket.io/ requires
  # SNI extensions which is not supported in python 2.7.9 and we use 2.7.6.
  deps = {'socket.io-client': 'socket.io.js'}
  for dirpath, unused_dirnames, files in os.walk('node_modules'):
    for subdir in deps:
      for name in files:
        if name.endswith(deps[subdir]):
            print 'Copying %s' % deps[subdir]
            shutil.copy(os.path.join(dirpath, name), path)

  # Verify that files in |deps| has been copied else fail build.
  for dirpath, unused_dirnames, files in os.walk(path):
    for subdir in deps:
      if os.path.isfile(os.path.join(path, deps[subdir])):
        print 'File found %s' % deps[subdir]
      else:
        raise NameError('Could not find: %s' + ', please try \
            "npm update/install."' \
            % os.path.join('node_modules', dirpath, deps[dirpath]))


def CopyApprtcSource(src_path, dest_path):
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
        if (name.endswith('.py') and 'test' not in name
            or name.endswith('.yaml')):
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


def main():
  parser = optparse.OptionParser(USAGE)
  parser.add_option("-t", "--include-tests", action="store_true",
                    help='Also copy python tests to the out dir.')
  options, args = parser.parse_args()
  if len(args) != 2:
    parser.error('Error: Exactly 2 arguments required.')

  src_path, dest_path = args[0:2]
  CopyApprtcSource(src_path, dest_path)
  downloadCallstats()
  if options.include_tests:
    app_engine_code = os.path.join(src_path, 'app_engine')
    test_file_herder.CopyTests(os.path.join(src_path, 'app_engine'), dest_path)


if __name__ == '__main__':
  sys.exit(main())
