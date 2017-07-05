#!/usr/bin/python

import os
import sys
import urllib3
import urllib3.contrib.pyopenssl
import certifi
import tarfile
import subprocess

# We are downloading a specific version of the Gcloud SDK because we have not
# found a URL to fetch the "latest" version.
# The installation updates the SDK so there is no need to update the downloaded
# version too often.
# If it is needed to update the downloaded version please refer to:
# https://cloud.google.com/sdk/downloads#versioned

GCLOUD_DOWNLOAD_URL = 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/'
GCLOUD_SDK_TAR_FILE = 'google-cloud-sdk-138.0.0-linux-x86_64.tar.gz'
GCLOUD_SDK_INSTALL_FOLDER = 'google-cloud-sdk'
TEMP_DIR = 'temp'
GCLOUD_SDK_PATH = os.path.join(TEMP_DIR, GCLOUD_SDK_INSTALL_FOLDER)

def _Download(url, to):
  print 'Downloading %s to %s...' % (url, to)
  # Using certifi.old_where() because old versions of OpenSSL sometimes fails
  # to validate certificate chains that use the strong roots [certifi.where()].
  urllib3.contrib.pyopenssl.inject_into_urllib3()
  http = urllib3.PoolManager(
      cert_reqs='CERT_REQUIRED',
      ca_certs=certifi.old_where()
  )
  response = http.request('GET', url, preload_content=False)
  with open(to, 'w') as to_file:
    for chunk in response.stream(1024):
      to_file.write(chunk)
  response.release_conn()


def _Extract(file_to_extract_path, destination_path):
  print 'Extracting %s in %s...' % (file_to_extract_path, destination_path)
  with tarfile.open(file_to_extract_path, 'r:gz') as tar_file:
    tar_file.extractall(destination_path)


def _EnsureAppEngineIsInstalled(path_to_gcloud_sdk):
  gcloud_exec = os.path.join(path_to_gcloud_sdk, 'bin', 'gcloud')
  subprocess.call([gcloud_exec, '--quiet',
                   'components', 'install', 'app-engine-python'])
  subprocess.call([gcloud_exec, '--quiet',
                   'components', 'update'])


def _Cleanup(file_paths_to_remove):
  for file_path in file_paths_to_remove:
    if os.path.exists(file_path):
      print 'Cleaning up %s' % file_path
      os.remove(file_path)


def main():
  if not os.path.exists(TEMP_DIR):
    os.mkdir(TEMP_DIR)

  if os.path.isfile(os.path.join(GCLOUD_SDK_PATH, 'bin', 'gcloud')):
    print 'Already has %s, skipping the download' % GCLOUD_SDK_INSTALL_FOLDER
    _EnsureAppEngineIsInstalled(GCLOUD_SDK_PATH)
    _Cleanup([os.path.join(TEMP_DIR, GCLOUD_SDK_TAR_FILE)])
    return

  _Download(GCLOUD_DOWNLOAD_URL + GCLOUD_SDK_TAR_FILE,
            os.path.join(TEMP_DIR, GCLOUD_SDK_TAR_FILE))
  _Extract(os.path.join(TEMP_DIR, GCLOUD_SDK_TAR_FILE), TEMP_DIR)
  _EnsureAppEngineIsInstalled(GCLOUD_SDK_PATH)
  _Cleanup([os.path.join(TEMP_DIR, GCLOUD_SDK_TAR_FILE)])


if __name__ == "__main__":
  sys.exit(main())
