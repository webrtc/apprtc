#!/usr/bin/python

import os
import re
import sys
import urllib2
import zipfile
import pip


GAE_DOWNLOAD_URL = 'https://storage.googleapis.com/appengine-sdks/featured/'
GAE_UPDATECHECK_URL = 'https://appengine.google.com/api/updatecheck'

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


def _Unzip(path, dir):
  print 'Unzipping %s in %s...' % (path, os.getcwd())
  zip_file = zipfile.ZipFile(path)
  try:
    zip_file.extractall(dir)
  finally:
    zip_file.close()


def Install(package):
  try:
    print 'Installing python package using pip: ' + package
    pip.main(['install', '--user' , package])
  except OSError:
    print 'Could not install %s due to : %s' % package % OSError



def DownloadAppEngineSdkIfNecessary():
  gae_sdk_version = _GetLatestAppEngineSdkVersion()
  gae_sdk_file = 'google_appengine_%s.zip' % gae_sdk_version
  temp_dir = 'temp/'
  if not os.path.exists(temp_dir):
    os.mkdir(temp_dir)

  if os.path.exists(temp_dir + gae_sdk_file):
    print 'Already has %s, skipping' % gae_sdk_file
    return

  _Download(GAE_DOWNLOAD_URL + gae_sdk_file, temp_dir + gae_sdk_file)
  _Unzip(temp_dir + gae_sdk_file, temp_dir)

def main():
  Install('requests')
  Install('WebTest')
  DownloadAppEngineSdkIfNecessary()
  # setUpTempDir()

if __name__ == '__main__':
  sys.exit(main())
