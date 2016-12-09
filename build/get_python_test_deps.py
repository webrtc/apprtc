#!/usr/bin/python

import os
import pip
import re
import sys
import urllib2
import zipfile


GAE_DOWNLOAD_URL = 'https://storage.googleapis.com/appengine-sdks/featured/'
TEMP_DIR = 'temp/'

def _GetLatestAppEngineSdkVersion():
  # Since https://appengine.google.com/api/updatecheck has started returning
  # version 0.0.0 we will hard code the version instead. Historically its been
  # really flaky returning incorrect versions but now it's unusable. This is
  # most likely due to migrating to the new gcloud sdk.
  # TODO: Update to use the gcloud sdk.
  gae_sdk_version = '1.9.49'
  return gae_sdk_version


def _Download(url, to):
  print 'Downloading %s to %s...' % (url, to)
  response = urllib2.urlopen(url)
  with open(to, 'w') as to_file:
    to_file.write(response.read())


def _Unzip(path, dir):
  print 'Unzipping %s in %s...' % (path, dir)
  zip_file = zipfile.ZipFile(path)
  with zipfile.ZipFile(path) as zip_file:
    zip_file.extractall(dir)


def Install(package):
  try:
    print 'Installing python package using pip: ' + package
    pip.main(['install', '--user' , package])
  except OSError as e:
    print 'Could not install %s due to : %s' % (package, e)


def DownloadAppEngineSdkIfNecessary():
  gae_sdk_version = _GetLatestAppEngineSdkVersion()
  gae_sdk_file = 'google_appengine_%s.zip' % gae_sdk_version
  if not os.path.exists(TEMP_DIR):
    os.mkdir(TEMP_DIR)

  if os.path.exists(TEMP_DIR + gae_sdk_file):
    print 'Already has %s, skipping' % gae_sdk_file
    return

  _Download(GAE_DOWNLOAD_URL + gae_sdk_file, TEMP_DIR + gae_sdk_file)
  _Unzip(TEMP_DIR + gae_sdk_file, TEMP_DIR)


def main():
  Install('requests')
  Install('WebTest')
  DownloadAppEngineSdkIfNecessary()


if __name__ == '__main__':
  sys.exit(main())
