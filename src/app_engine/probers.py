#!/usr/bin/python2.4
#
# Copyright 2014 Google Inc. All Rights Reserved.

"""AppRTC Probers

This module implements CEOD and collider probers.
"""

import constants
import logging
import json
import numbers
import webapp2

from google.appengine.api import mail
from google.appengine.api import memcache
from google.appengine.api import urlfetch

def send_alert_email(tag, message):
  receiver = 'apprtc-monitor@google.com'
  sender_address = 'AppRTC Notification <jiayl@google.com>'
  subject = 'AppRTC Prober Alert: ' + tag
  body =  """
  AppRTC Prober detected an error:

  %s

  Goto go/apprtc-sheriff for how to handle this error.
  """ % message

  logging.info('Sending email to %s: subject=%s, message=%s' \
      % (receiver, subject, message))
  mail.send_mail(sender_address, receiver, subject, body)

def has_non_empty_string_value(dict, key):
  return key in dict and \
         isinstance(dict[key], basestring) and \
         dict[key] != ''

def has_non_empty_array_value(dict, key):
  return key in dict and \
         isinstance(dict[key], list) and \
         len(dict[key]) > 0

class ProbeCEODPage(webapp2.RequestHandler):
  def handle_ceod_response(self, error_message, status_code):
    self.response.set_status(status_code)
    if error_message is not None:
      send_alert_email('CEOD Error', error_message)

      logging.warning('CEOD prober error: ' + error_message)
      self.response.out.write(error_message)
    else:
      self.response.out.write('Success!')

  def get(self):
    ceod_url = constants.TURN_URL_TEMPLATE \
        % (constants.TURN_BASE_URL, 'prober', constants.CEOD_KEY)
    sanitized_url = constants.TURN_URL_TEMPLATE % \
        (constants.TURN_BASE_URL, 'prober', '<obscured>')

    error_message = None
    result = None
    try:
      result = urlfetch.fetch(url=ceod_url, method=urlfetch.GET)
    except Exception as e:
      error_message = 'urlfetch throws exception: ' + str(e) + \
          ', url = ' + sanitized_url
      self.handle_ceod_response(error_message, 500)
      return

    status_code = result.status_code
    if status_code != 200:
      error_message = 'Unexpected CEOD response: %d, requested URL: %s' \
          % (result.status_code, sanitized_url)
    else:
      try:
        turn_server = json.loads(result.content)
        if not has_non_empty_string_value(turn_server, 'username') or \
           not has_non_empty_string_value(turn_server, 'password') or \
           not has_non_empty_array_value(turn_server, 'uris'):
          error_message = 'CEOD response does not contain valid ' + \
              'username/password/uris: response = ' + result.content + \
              ', url = ' + sanitized_url
          status_code = 500
      except Exception as e:
        error_message = """
        CEOD response cannot be decoded as JSON:
        exception = %s,
        response = %s,
        url = %s
        """ % (str(e), result.content, sanitized_url)
        status_code = 500

    self.handle_ceod_response(error_message, status_code)

class ProbeColliderPage(webapp2.RequestHandler):
  def handle_collider_response(
      self, error_message, status_code, collider_instance):
    result = {
        constants.WSS_HOST_STATUS_CODE_KEY: status_code
    }
    if error_message is not None:
      send_alert_email('Collider Error (' + collider_instance + ')',
                       error_message)

      logging.warning('Collider prober error: ' + error_message)
      result[constants.WSS_HOST_ERROR_MESSAGE_KEY] = error_message
      result[constants.WSS_HOST_IS_UP_KEY] = False
    else:
      result[constants.WSS_HOST_IS_UP_KEY] = True
    return result

  def store_instance_state(self, probing_results):
    # Store an active collider host to memcache to be served to clients.
    # If the currently active host is still up, keep it. If not, pick a
    # new active host that is up.
    memcache_client = memcache.Client()
    for retries in xrange(constants.MEMCACHE_RETRY_LIMIT):
      active_host = memcache_client.gets(constants.WSS_HOST_ACTIVE_HOST_KEY)
      if active_host is None:
        memcache_client.set(constants.WSS_HOST_ACTIVE_HOST_KEY, '')
        active_host = memcache_client.gets(constants.WSS_HOST_ACTIVE_HOST_KEY)
      active_host = self.create_collider_active_host(active_host,
                                                     probing_results)
      if memcache_client.cas(constants.WSS_HOST_ACTIVE_HOST_KEY, active_host):
        logging.info('collider active host saved to memcache: ' +
                     str(active_host))
        break
      logging.warning('retry # ' + str(retries) + ' to set collider status')

  def create_collider_active_host(self, old_active_host, probing_results):
    # If the old_active_host is still up, keep it. If not, pick a new active
    # host that is up.
    try:
      if (old_active_host in probing_results and
          probing_results[old_active_host].get(
              constants.WSS_HOST_IS_UP_KEY, False)):
        return old_active_host
    except TypeError:
      pass
    for instance in probing_results:
      if probing_results[instance].get(constants.WSS_HOST_IS_UP_KEY, False):
        return instance
    return None

  def get(self):
    results = {}
    for collider_instance in constants.WSS_HOST_PORT_PAIRS:
      results[collider_instance] = self.probe_collider_instance(
          collider_instance)
    self.response.write(json.dumps(results, indent=2, sort_keys=True))
    self.store_instance_state(results)

  def probe_collider_instance(self, collider_instance):
    url = 'https://' + collider_instance + '/status';

    error_message = None
    result = None
    try:
      result = urlfetch.fetch(url=url, method=urlfetch.GET)
    except Exception as e:
      error_message = 'urlfetch throws exception: ' + str(e) + ', url = ' + url
      return self.handle_collider_response(error_message, 500, collider_instance)

    status_code = result.status_code
    if status_code != 200:
      error_message = 'Unexpected collider response: %d, requested URL: %s' \
          % (result.status_code, url)
    else:
      try:
        status_report = json.loads(result.content)
        if not 'upsec' in status_report or \
            not isinstance(status_report['upsec'], numbers.Number):
          error_message = """
          Invalid 'upsec' field in Collider status response,
          status = %s
          """ % result.content
          status_code = 500
      except Exception as e:
        error_message = """
        Collider status response cannot be decoded as JSON:
        exception = %s,
        response = %s,
        url = %s
        """ % (str(e), result.content, url)
        status_code = 500

    return self.handle_collider_response(
        error_message, status_code, collider_instance)

app = webapp2.WSGIApplication([
    ('/probe/ceod', ProbeCEODPage),
    ('/probe/collider', ProbeColliderPage),
], debug=True)
