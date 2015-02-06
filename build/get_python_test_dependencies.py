#!/usr/bin/python

import optparse
import os
import re
import sys
import tarfile
import urllib2
import zipfile


GAE_DOWNLOAD_URL = 'https://storage.googleapis.com/appengine-sdks/featured/'
GAE_UPDATECHECK_URL = 'https://appengine.google.com/api/updatecheck'
WEBTEST_URL = 'https://nodeload.github.com/Pylons/webtest/tar.gz/master'


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
    tar_file.close()


def DownloadAppEngineSdkIfNecessary():
  gae_sdk_version = _GetLatestAppEngineSdkVersion()
  gae_sdk_file = 'google_appengine_%s.zip' % gae_sdk_version
  _Download(GAE_DOWNLOAD_URL + gae_sdk_file, gae_sdk_file)
  _Unzip(gae_sdk_file)


def _InstallWebTestOnLinux(webtest_dir):
  cwd = os.getcwd()
  try:
    print 'About to install webtest into your system python.'
    print 'Enter your password if you agree.'
    os.chdir(webtest_dir)
    os.system('sudo python setup.py install')
  finally:
    os.chdir(cwd)


def DownloadWebTestIfNecessary():
  webtest_file = 'webtest-master.tar.gz'
  _Download(WEBTEST_URL, webtest_file)
  _Untar(webtest_file)


def _EnsureWebTestIsInstalled():
  try:
    import webtest
    return 0
  except ImportError:
    print 'You need to install webtest before you can proceed running the '
    print 'tests. To do this you need to get easy_install. See '
    print 'https://pythonhosted.org/setuptools/easy_install.html'
    print 'Then:'
    print 'cd webtest-master'
    print 'sudo python setup.py install'
    return 1


def main():
  usage = 'usage: %prog [options]'
  parser = optparse.OptionParser(usage)
  parser.add_option('-a', '--auto-install-on-linux', action='store_true',
                    help=('Attempt to install dependencies automatically '
                          '(i.e. Travis mode). Only supported on Linux.'))
  options, _ = parser.parse_args()
  DownloadAppEngineSdkIfNecessary()
  DownloadWebTestIfNecessary()
  if options.auto_install_on_linux:
    _InstallWebTestOnLinux('webtest-master')
  
  return _EnsureWebTestIsInstalled()

if __name__ == '__main__':
  sys.exit(main())
