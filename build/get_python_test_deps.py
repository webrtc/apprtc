#!/usr/bin/python

import os
import re
import sys
import tarfile
import urllib2
import zipfile


GAE_DOWNLOAD_URL = 'https://storage.googleapis.com/appengine-sdks/featured/'
GAE_UPDATECHECK_URL = 'https://appengine.google.com/api/updatecheck'
WEBTEST_URL = 'https://nodeload.github.com/Pylons/webtest/tar.gz/master'
REQUESTS_URL = 'https://github.com/kennethreitz/requests/tarball/master'
TEMP_DIR = 'temp'

def setUpTempDir():
  if not os.path.exists(TEMP_DIR):
    os.mkdir(TEMP_DIR)

  os.chdir(TEMP_DIR)

def _GetLatestAppEngineSdkVersion():
  response = urllib2.urlopen(GAE_UPDATECHECK_URL)
  response_text = response.read()

  match = re.search('(\d*\.\d*\.\d*)', response_text)
  if not match:
    raise Exception('Could not determine latest GAE SDK version from '
                    'response %s.' % response_text)
  gae_sdk_version = match.group(1)
  if gae_sdk_version == '1.9.15':
    # TODO(phoglund): remove when updatecheck returns the right thing.
    gae_sdk_version = '1.9.17'
  if gae_sdk_version == '1.9.19':
    # TODO(phoglund): remove when updatecheck returns the right thing.
    gae_sdk_version = '1.9.21'
  return gae_sdk_version


def _Download(url, to):
  print 'Downloading %s to %s...' % (url, to)
  response = urllib2.urlopen(url)
  with open(to, 'w') as to_file:
    to_file.write(response.read())


def _Unzip(path):
  print 'Unzipping %s in %s...' % (path, os.getcwd())
  zip_file = zipfile.ZipFile(path)
  try:
    zip_file.extractall()
  finally:
    zip_file.close()


def _Untar(path):
  print 'Untarring %s in %s...' % (path, os.getcwd())
  tar_file = tarfile.open(path, 'r:gz')
  try:
    tar_file.extractall()
  finally:
    dir_name = tar_file.getnames()
    tar_file.close()
      # Return the first member in the returned list as it's the top dir
      # name. Useful for passing on the top/first output dir name to other
      # functions.
    return dir_name[0]

# Installs the requests python module.
def _InstallRequests(requests_dir):
  cwd = os.getcwd()
  try:
    print 'About to install requests module into your system python.'
    os.chdir(requests_dir)
    result = os.system('sudo python setup.py install')
    if result == 0:
      print 'Install successful.'
    else:
      return ('Failed to install requests; are you missing setuptools / '
              'easy_install in your system python?')
  finally:
    os.chdir(cwd)

def DownloadAppEngineSdkIfNecessary():
  gae_sdk_version = _GetLatestAppEngineSdkVersion()
  gae_sdk_file = 'google_appengine_%s.zip' % gae_sdk_version
  if os.path.exists(gae_sdk_file):
    print 'Already has %s, skipping' % gae_sdk_file
    return

  _Download(GAE_DOWNLOAD_URL + gae_sdk_file, gae_sdk_file)
  _Unzip(gae_sdk_file)


def DownloadWebTestIfNecessary():
  webtest_file = 'webtest-master.tar.gz'
  if os.path.exists(webtest_file):
    print 'Already has %s, skipping' % webtest_file
    return

  _Download(WEBTEST_URL, webtest_file)
  _Untar(webtest_file)

# Downloads the requests python module used to download other deps.
def DownloadRequestsIfNecessary():
  request_file = 'requestsPythonModule'
  if 'requests' in sys.modules or os.path.exists(request_file):
    print 'Already has %s, skipping' % request_file
    # return

  _Download(REQUESTS_URL, request_file )
  untarred_dir_name = _Untar(request_file)

  _InstallRequests(untarred_dir_name)


def main():
  setUpTempDir()
  DownloadAppEngineSdkIfNecessary()
  DownloadWebTestIfNecessary()
  DownloadRequestsIfNecessary()

if __name__ == '__main__':
  sys.exit(main())
