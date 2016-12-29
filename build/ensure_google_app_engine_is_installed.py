#!/usr/bin/python

import os
import sys
import zipfile
import urllib3
import urllib3.contrib.pyopenssl
import certifi


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
  # Using certifi.old_where() because old versions of OpenSSL sometimes fails
  # to validate certificate chains that use the strong roots [certifi.where()].
  http = urllib3.PoolManager(
      cert_reqs='CERT_REQUIRED',
      ca_certs=certifi.old_where()
  )
  response = http.request('GET', url, preload_content=False)
  with open(to, 'w') as to_file:
    for chunk in response.stream(1024):
      to_file.write(chunk)
  response.release_conn()


def _Unzip(path, dir):
  print 'Unzipping %s in %s...' % (path, dir)
  zip_file = zipfile.ZipFile(path)
  with zipfile.ZipFile(path) as zip_file:
    zip_file.extractall(dir)

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
  DownloadAppEngineSdkIfNecessary()


if __name__ == '__main__':
  # Workaround for using SSL with SNI extensions on older python 2.x versions.
  # Must do this due to the python version used on Google AppEngine.
  urllib3.contrib.pyopenssl.inject_into_urllib3()
  sys.exit(main())
