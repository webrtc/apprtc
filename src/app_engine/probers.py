# Copyright 2014 Google Inc. All Rights Reserved.

"""AppRTC Probers.

This module implements collider prober.
"""

import json
import logging
import numbers

import compute_page
import constants
import webapp2

from google.appengine.api import app_identity
from google.appengine.api import mail
from google.appengine.api import memcache
from google.appengine.api import urlfetch


PROBER_FETCH_DEADLINE = 30

def is_prober_enabled():
  """Check the application ID so that other projects hosting AppRTC code does
  not hit Collider unnecessarily."""
  return app_identity.get_application_id() == 'apprtc'

def send_alert_email(tag, message):
  """Send an alert email to apprtc-alert@google.com."""
  receiver = 'apprtc-alert@google.com'
  sender_address = 'AppRTC Notification <apprtc@webrtc.org>'
  subject = 'AppRTC Prober Alert: ' + tag
  body = """
  AppRTC Prober detected an error:

  %s

  Goto go/apprtc-sheriff for how to handle this error.
  """ % message

  logging.info('Sending email to %s: subject=%s, message=%s',
               receiver, subject, message)
  mail.send_mail(sender_address, receiver, subject, body)


def has_non_empty_string_value(dictionary, key):
  return (key in dictionary and
          isinstance(dictionary[key], basestring) and
          dictionary[key])


def has_non_empty_array_value(dictionary, key):
  return (key in dictionary and
          isinstance(dictionary[key], list) and
          dictionary[key])


def get_collider_probe_success_key(instance_host):
  """Returns the memcache key for the last collider instance probing result."""
  return 'last_collider_probe_success_' + instance_host


class ProbeColliderPage(webapp2.RequestHandler):
  """Page to probe Collider instances."""

  def handle_collider_response(
      self, error_message, status_code, collider_instance):

    """Send an alert email and restart the instance if needed.

    Args:
      error_message: The error message for the response, or None if no error.
      status_code: The status code of the HTTP response.
      collider_instance: One of constants.WSS_INSTANCES representing the
      instance being handled.

    Returns:
      A dictionary object containing the result.
    """

    result = {
        constants.WSS_HOST_STATUS_CODE_KEY: status_code
    }
    memcache_key = get_collider_probe_success_key(
        collider_instance[constants.WSS_INSTANCE_NAME_KEY])

    host = collider_instance[constants.WSS_INSTANCE_HOST_KEY]

    if error_message is not None:
      logging.warning(
          'Collider prober error: ' + error_message + ' for ' + host)
      result[constants.WSS_HOST_ERROR_MESSAGE_KEY] = error_message
      result[constants.WSS_HOST_IS_UP_KEY] = False

      last_probe_success = memcache.get(memcache_key)

      # Restart the collider instance if the last probing was successful.
      if last_probe_success is None or last_probe_success is True:
        logging.info('Restarting the collider instance')
        compute_page.enqueue_restart_task(
            collider_instance[constants.WSS_INSTANCE_NAME_KEY],
            collider_instance[constants.WSS_INSTANCE_ZONE_KEY])
        error_message += """

        Restarting the collider instance automatically.

        """

      send_alert_email('Collider %s error' % host, error_message)
    else:
      result[constants.WSS_HOST_IS_UP_KEY] = True

    memcache.set(memcache_key, result[constants.WSS_HOST_IS_UP_KEY])

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
    if not is_prober_enabled():
      return

    results = {}
    for instance in constants.WSS_INSTANCES:
      host = instance[constants.WSS_INSTANCE_HOST_KEY]
      results[host] = self.probe_collider_instance(instance)
    self.response.write(json.dumps(results, indent=2, sort_keys=True))
    self.store_instance_state(results)

  def probe_collider_instance(self, collider_instance):
    collider_host = collider_instance[constants.WSS_INSTANCE_HOST_KEY]
    url = 'https://' + collider_host + '/status'

    error_message = None
    result = None
    try:
      result = urlfetch.fetch(
          url=url, method=urlfetch.GET, deadline=PROBER_FETCH_DEADLINE)
    except urlfetch.Error as e:
      error_message = ('urlfetch throws exception: %s' % str(e))
      return self.handle_collider_response(
          error_message, 500, collider_instance)

    status_code = result.status_code
    if status_code != 200:
      error_message = ('Unexpected collider response: %d, requested URL: %s'
                       % (result.status_code, url))
    else:
      try:
        status_report = json.loads(result.content)
        if ('upsec' not in status_report or
            not isinstance(status_report['upsec'], numbers.Number)):
          error_message = """
          Invalid 'upsec' field in Collider status response,
          status = %s
          """ % result.content
          status_code = 500
      except ValueError as e:
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
    ('/probe/collider', ProbeColliderPage),
], debug=True)
