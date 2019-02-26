#!/usr/bin/python2.4
#
# Copyright 2011 Google Inc. All Rights Reserved.

"""WebRTC Demo

This module demonstrates the WebRTC API by implementing a simple video chat app.
"""

import cgi
import json
import logging
import os
import random
import threading

import jinja2
import webapp2
from google.appengine.api import app_identity
from google.appengine.api import memcache
from google.appengine.api import urlfetch

import analytics
import analytics_page
import compute_page
import constants

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))


def generate_random(length):
  word = ''
  for _ in range(length):
    word += random.choice('0123456789')
  return word

# HD is on by default for desktop Chrome, but not Android or Firefox (yet)
def get_hd_default(user_agent):
  if 'Android' in user_agent or not 'Chrome' in user_agent:
    return 'false'
  return 'true'

# iceServers will be filled in by the TURN HTTP request.
def make_pc_config(ice_transports, ice_server_override):
  config = {
  'iceServers': [],
  'bundlePolicy': 'max-bundle',
  'rtcpMuxPolicy': 'require'
  };
  if ice_server_override:
    config['iceServers'] = ice_server_override
  if ice_transports:
    config['iceTransports'] = ice_transports
  return config

def add_media_track_constraint(track_constraints, constraint_string):
  tokens = constraint_string.split(':')
  mandatory = True
  if len(tokens) == 2:
    # If specified, e.g. mandatory:minHeight=720, set mandatory appropriately.
    mandatory = (tokens[0] == 'mandatory')
  else:
    # Otherwise, default to mandatory, except for goog constraints, which
    # won't work in other browsers.
    mandatory = not tokens[0].startswith('goog')

  tokens = tokens[-1].split('=')
  if len(tokens) == 2:
    if mandatory:
      track_constraints['mandatory'][tokens[0]] = tokens[1]
    else:
      track_constraints['optional'].append({tokens[0]: tokens[1]})
  else:
    logging.error('Ignoring malformed constraint: ' + constraint_string)

def make_media_track_constraints(constraints_string):
  if not constraints_string or constraints_string.lower() == 'true':
    track_constraints = True
  elif constraints_string.lower() == 'false':
    track_constraints = False
  else:
    track_constraints = {'mandatory': {}, 'optional': []}
    for constraint_string in constraints_string.split(','):
      add_media_track_constraint(track_constraints, constraint_string)

  return track_constraints

def make_media_stream_constraints(audio, video, firefox_fake_device):
  stream_constraints = (
      {'audio': make_media_track_constraints(audio),
       'video': make_media_track_constraints(video)})
  if firefox_fake_device:
    stream_constraints['fake'] = True
  logging.info('Applying media constraints: ' + str(stream_constraints))
  return stream_constraints

def maybe_add_constraint(constraints, param, constraint):
  if (param.lower() == 'true'):
    constraints['optional'].append({constraint: True})
  elif (param.lower() == 'false'):
    constraints['optional'].append({constraint: False})

  return constraints

def make_pc_constraints(dtls, dscp, ipv6):
  constraints = {'optional': []};
  maybe_add_constraint(constraints, dtls, 'DtlsSrtpKeyAgreement')
  maybe_add_constraint(constraints, dscp, 'googDscp')
  maybe_add_constraint(constraints, ipv6, 'googIPv6')

  return constraints

def append_url_arguments(request, link):
  arguments = request.arguments()
  if len(arguments) == 0:
    return link
  link += ('?' + cgi.escape(arguments[0], True) + '=' +
           cgi.escape(request.get(arguments[0]), True))
  for argument in arguments[1:]:
    link += ('&' + cgi.escape(argument, True) + '=' +
             cgi.escape(request.get(argument), True))
  return link

def get_wss_parameters(request):
  wss_host_port_pair = request.get('wshpp')
  wss_tls = request.get('wstls')

  if not wss_host_port_pair:
    # Attempt to get a wss server from the status provided by prober,
    # if that fails, use fallback value.
    memcache_client = memcache.Client()
    wss_active_host = memcache_client.get(constants.WSS_HOST_ACTIVE_HOST_KEY)
    if wss_active_host in constants.WSS_HOST_PORT_PAIRS:
      wss_host_port_pair = wss_active_host
    else:
      logging.warning(
          'Invalid or no value returned from memcache, using fallback: '
          + json.dumps(wss_active_host))
      wss_host_port_pair = constants.WSS_HOST_PORT_PAIRS[0]

  if wss_tls and wss_tls == 'false':
    wss_url = 'ws://' + wss_host_port_pair + '/ws'
    wss_post_url = 'http://' + wss_host_port_pair
  else:
    wss_url = 'wss://' + wss_host_port_pair + '/ws'
    wss_post_url = 'https://' + wss_host_port_pair
  return (wss_url, wss_post_url)

def get_version_info():
  try:
    path = os.path.join(os.path.dirname(__file__), 'version_info.json')
    f = open(path)
    if f is not None:
      try:
        return json.load(f)
      except ValueError as e:
        logging.warning('version_info.json cannot be decoded: ' + str(e))
  except IOError as e:
    logging.info('version_info.json cannot be opened: ' + str(e))
  return None

# Returns appropriate room parameters based on query parameters in the request.
# TODO(tkchin): move query parameter parsing to JS code.
def get_room_parameters(request, room_id, client_id, is_initiator):
  error_messages = []
  warning_messages = []
  # Get the base url without arguments.
  base_url = request.path_url
  user_agent = request.headers['User-Agent']

  # HTML or JSON.
  response_type = request.get('t')
  # Which ICE candidates to allow. This is useful for forcing a call to run
  # over TURN, by setting it=relay.
  ice_transports = request.get('it')
  # Which ICE server transport= to allow (i.e., only TURN URLs with
  # transport=<tt> will be used). This is useful for forcing a session to use
  # TURN/TCP, by setting it=relay&tt=tcp.
  ice_server_transports = request.get('tt')
  # A HTTP server that will be used to find the right ICE servers to use, as
  # described in http://tools.ietf.org/html/draft-uberti-rtcweb-turn-rest-00.
  ice_server_base_url = request.get('ts', default_value =
      constants.ICE_SERVER_BASE_URL)

  # Use "audio" and "video" to set the media stream constraints. Defined here:
  # http://goo.gl/V7cZg
  #
  # "true" and "false" are recognized and interpreted as bools, for example:
  #   "?audio=true&video=false" (Start an audio-only call.)
  #   "?audio=false" (Start a video-only call.)
  # If unspecified, the stream constraint defaults to True.
  #
  # To specify media track constraints, pass in a comma-separated list of
  # key/value pairs, separated by a "=". Examples:
  #   "?audio=googEchoCancellation=false,googAutoGainControl=true"
  #   (Disable echo cancellation and enable gain control.)
  #
  #   "?video=minWidth=1280,minHeight=720,googNoiseReduction=true"
  #   (Set the minimum resolution to 1280x720 and enable noise reduction.)
  #
  # Keys starting with "goog" will be added to the "optional" key; all others
  # will be added to the "mandatory" key.
  # To override this default behavior, add a "mandatory" or "optional" prefix
  # to each key, e.g.
  #   "?video=optional:minWidth=1280,optional:minHeight=720,
  #           mandatory:googNoiseReduction=true"
  #   (Try to do 1280x720, but be willing to live with less; enable
  #    noise reduction or die trying.)
  #
  # The audio keys are defined here: talk/app/webrtc/localaudiosource.cc
  # The video keys are defined here: talk/app/webrtc/videosource.cc
  audio = request.get('audio')
  video = request.get('video')

  # Pass firefox_fake_device=1 to pass fake: true in the media constraints,
  # which will make Firefox use its built-in fake device.
  firefox_fake_device = request.get('firefox_fake_device')

  # The hd parameter is a shorthand to determine whether to open the
  # camera at 720p. If no value is provided, use a platform-specific default.
  # When defaulting to HD, use optional constraints, in case the camera
  # doesn't actually support HD modes.
  hd = request.get('hd').lower()
  if hd and video:
    message = 'The "hd" parameter has overridden video=' + video
    logging.warning(message)
    # HTML template is UTF-8, make sure the string is UTF-8 as well.
    warning_messages.append(message.encode('utf-8'))
  if hd == 'true':
    video = 'mandatory:minWidth=1280,mandatory:minHeight=720'
  elif not hd and not video and get_hd_default(user_agent) == 'true':
    video = 'optional:minWidth=1280,optional:minHeight=720'

  if request.get('minre') or request.get('maxre'):
    message = ('The "minre" and "maxre" parameters are no longer ' +
        'supported. Use "video" instead.')
    logging.warning(message)
    # HTML template is UTF-8, make sure the string is UTF-8 as well.
    warning_messages.append(message.encode('utf-8'))

  # Options for controlling various networking features.
  dtls = request.get('dtls')
  dscp = request.get('dscp')
  ipv6 = request.get('ipv6')

  debug = request.get('debug')
  if debug == 'loopback':
    # Set dtls to false as DTLS does not work for loopback.
    dtls = 'false'
    include_loopback_js = '<script src="/js/loopback.js"></script>'
  else:
    include_loopback_js = ''

  # TODO(tkchin): We want to provide a ICE request url on the initial get,
  # but we don't provide client_id until a join. For now just generate
  # a random id, but we should make this better.
  username = client_id if client_id is not None else generate_random(9)
  if len(ice_server_base_url) > 0:
    ice_server_url = constants.ICE_SERVER_URL_TEMPLATE % \
        (ice_server_base_url, constants.ICE_SERVER_API_KEY)
  else:
    ice_server_url = ''

  # If defined it will override the ICE server provider and use the specified
  # turn servers directly.
  ice_server_override = constants.ICE_SERVER_OVERRIDE

  pc_config = make_pc_config(ice_transports, ice_server_override)
  pc_constraints = make_pc_constraints(dtls, dscp, ipv6)
  offer_options = {};
  media_constraints = make_media_stream_constraints(audio, video,
                                                    firefox_fake_device)
  wss_url, wss_post_url = get_wss_parameters(request)

  bypass_join_confirmation = 'BYPASS_JOIN_CONFIRMATION' in os.environ and \
      os.environ['BYPASS_JOIN_CONFIRMATION'] == 'True'

  params = {
    'error_messages': error_messages,
    'warning_messages': warning_messages,
    'is_loopback' : json.dumps(debug == 'loopback'),
    'pc_config': json.dumps(pc_config),
    'pc_constraints': json.dumps(pc_constraints),
    'offer_options': json.dumps(offer_options),
    'media_constraints': json.dumps(media_constraints),
    'ice_server_url': ice_server_url,
    'ice_server_transports': ice_server_transports,
    'include_loopback_js' : include_loopback_js,
    'wss_url': wss_url,
    'wss_post_url': wss_post_url,
    'bypass_join_confirmation': json.dumps(bypass_join_confirmation),
    'version_info': json.dumps(get_version_info())
  }

  if room_id is not None:
    room_link = request.host_url + '/r/' + room_id
    room_link = append_url_arguments(request, room_link)
    params['room_id'] = room_id
    params['room_link'] = room_link
  if client_id is not None:
    params['client_id'] = client_id
  if is_initiator is not None:
    params['is_initiator'] = json.dumps(is_initiator)
  return params

# For now we have (room_id, client_id) pairs are 'unique' but client_ids are
# not. Uniqueness is not enforced however and bad things may happen if RNG
# generates non-unique numbers. We also have a special loopback client id.
# TODO(tkchin): Generate room/client IDs in a unique way while handling
# loopback scenario correctly.
class Client:
  def __init__(self, is_initiator):
    self.is_initiator = is_initiator
    self.messages = []
  def add_message(self, msg):
    self.messages.append(msg)
  def clear_messages(self):
    self.messages = []
  def set_initiator(self, initiator):
    self.is_initiator = initiator
  def __str__(self):
    return '{%r, %d}' % (self.is_initiator, len(self.messages))

class Room:
  def __init__(self):
    self.clients = {}
  def add_client(self, client_id, client):
    self.clients[client_id] = client
  def remove_client(self, client_id):
    del self.clients[client_id]
  def get_occupancy(self):
    return len(self.clients)
  def has_client(self, client_id):
    return client_id in self.clients
  def get_client(self, client_id):
    return self.clients[client_id]
  def get_other_client(self, client_id):
    for key, client in self.clients.items():
      if key is not client_id:
        return client
    return None
  def __str__(self):
    return str(self.clients.keys())

def get_memcache_key_for_room(host, room_id):
  return '%s/%s' % (host, room_id)

def add_client_to_room(request, room_id, client_id, is_loopback):
  key = get_memcache_key_for_room(request.host_url, room_id)
  memcache_client = memcache.Client()
  error = None
  retries = 0
  room = None
  # Compare and set retry loop.
  while True:
    is_initiator = None
    messages = []
    room_state = ''
    room = memcache_client.gets(key)
    if room is None:
      # 'set' and another 'gets' are needed for CAS to work.
      if not memcache_client.set(key, Room()):
        logging.warning('memcache.Client.set failed for key ' + key)
        error = constants.RESPONSE_ERROR
        break
      room = memcache_client.gets(key)

    occupancy = room.get_occupancy()
    if occupancy >= 2:
      error = constants.RESPONSE_ROOM_FULL
      break
    if room.has_client(client_id):
      error = constants.RESPONSE_DUPLICATE_CLIENT
      break

    if occupancy == 0:
      is_initiator = True
      room.add_client(client_id, Client(is_initiator))
      if is_loopback:
        room.add_client(constants.LOOPBACK_CLIENT_ID, Client(False))
    else:
      is_initiator = False
      other_client = room.get_other_client(client_id)
      messages = other_client.messages
      room.add_client(client_id, Client(is_initiator))
      other_client.clear_messages()

    if memcache_client.cas(key, room, constants.ROOM_MEMCACHE_EXPIRATION_SEC):
      logging.info('Added client %s in room %s, retries = %d' \
          %(client_id, room_id, retries))

      if room.get_occupancy() == 2:
        analytics.report_event(analytics.EventType.ROOM_SIZE_2,
                               room_id,
                               host=request.host)
      success = True
      break
    else:
      retries = retries + 1
  return {'error': error, 'is_initiator': is_initiator,
          'messages': messages, 'room_state': str(room)}

def remove_client_from_room(host, room_id, client_id):
  key = get_memcache_key_for_room(host, room_id)
  memcache_client = memcache.Client()
  retries = 0
  # Compare and set retry loop.
  while True:
    room = memcache_client.gets(key)
    if room is None:
      logging.warning('remove_client_from_room: Unknown room ' + room_id)
      return {'error': constants.RESPONSE_UNKNOWN_ROOM, 'room_state': None}
    if not room.has_client(client_id):
      logging.warning('remove_client_from_room: Unknown client ' + client_id + \
          ' for room ' + room_id)
      return {'error': constants.RESPONSE_UNKNOWN_CLIENT, 'room_state': None}

    room.remove_client(client_id)
    if room.has_client(constants.LOOPBACK_CLIENT_ID):
      room.remove_client(constants.LOOPBACK_CLIENT_ID)
    if room.get_occupancy() > 0:
      room.get_other_client(client_id).set_initiator(True)
    else:
      room = None

    if memcache_client.cas(key, room, constants.ROOM_MEMCACHE_EXPIRATION_SEC):
      logging.info('Removed client %s from room %s, retries=%d' \
          %(client_id, room_id, retries))
      return {'error': None, 'room_state': str(room)}
    retries = retries + 1

def save_message_from_client(host, room_id, client_id, message):
  text = None
  try:
      text = message.encode(encoding='utf-8', errors='strict')
  except Exception as e:
    return {'error': constants.RESPONSE_ERROR, 'saved': False}

  key = get_memcache_key_for_room(host, room_id)
  memcache_client = memcache.Client()
  retries = 0
  # Compare and set retry loop.
  while True:
    room = memcache_client.gets(key)
    if room is None:
      logging.warning('Unknown room: ' + room_id)
      return {'error': constants.RESPONSE_UNKNOWN_ROOM, 'saved': False}
    if not room.has_client(client_id):
      logging.warning('Unknown client: ' + client_id)
      return {'error': constants.RESPONSE_UNKNOWN_CLIENT, 'saved': False}
    if room.get_occupancy() > 1:
      return {'error': None, 'saved': False}

    client = room.get_client(client_id)
    client.add_message(text)
    if memcache_client.cas(key, room, constants.ROOM_MEMCACHE_EXPIRATION_SEC):
      logging.info('Saved message for client %s:%s in room %s, retries=%d' \
          %(client_id, str(client), room_id, retries))
      return {'error': None, 'saved': True}
    retries = retries + 1

class LeavePage(webapp2.RequestHandler):
  def post(self, room_id, client_id):
    result = remove_client_from_room(
        self.request.host_url, room_id, client_id)
    if result['error'] is None:
      logging.info('Room ' + room_id + ' has state ' + result['room_state'])

class MessagePage(webapp2.RequestHandler):
  def write_response(self, result):
    content = json.dumps({ 'result' : result })
    self.response.write(content)

  def send_message_to_collider(self, room_id, client_id, message):
    logging.info('Forwarding message to collider for room ' + room_id +
                 ' client ' + client_id)
    wss_url, wss_post_url = get_wss_parameters(self.request)
    url = wss_post_url + '/' + room_id + '/' + client_id
    result = urlfetch.fetch(url=url,
                            payload=message,
                            method=urlfetch.POST)
    if result.status_code != 200:
      logging.error(
          'Failed to send message to collider: %d' % (result.status_code))
      # TODO(tkchin): better error handling.
      self.error(500)
      return
    self.write_response(constants.RESPONSE_SUCCESS)

  def post(self, room_id, client_id):
    message_json = self.request.body
    result = save_message_from_client(
        self.request.host_url, room_id, client_id, message_json)
    if result['error'] is not None:
      self.write_response(result['error'])
      return
    if not result['saved']:
      # Other client joined, forward to collider. Do this outside the lock.
      # Note: this may fail in local dev server due to not having the right
      # certificate file locally for SSL validation.
      # Note: loopback scenario follows this code path.
      # TODO(tkchin): consider async fetch here.
      self.send_message_to_collider(room_id, client_id, message_json)
    else:
      self.write_response(constants.RESPONSE_SUCCESS)

class JoinPage(webapp2.RequestHandler):
  def write_response(self, result, params, messages):
    # TODO(tkchin): Clean up response format. For simplicity put everything in
    # params for now.
    params['messages'] = messages
    self.response.write(json.dumps({
      'result': result,
      'params': params
    }))

  def write_room_parameters(self, room_id, client_id, messages, is_initiator):
    params = get_room_parameters(self.request, room_id, client_id, is_initiator)
    self.write_response('SUCCESS', params, messages)

  def post(self, room_id):
    client_id = generate_random(8)
    is_loopback = self.request.get('debug') == 'loopback'
    result = add_client_to_room(self.request, room_id, client_id, is_loopback)
    if result['error'] is not None:
      logging.info('Error adding client to room: ' + result['error'] + \
          ', room_state=' + result['room_state'])
      self.write_response(result['error'], {}, [])
      return

    self.write_room_parameters(
        room_id, client_id, result['messages'], result['is_initiator'])
    logging.info('User ' + client_id + ' joined room ' + room_id)
    logging.info('Room ' + room_id + ' has state ' + result['room_state'])

class MainPage(webapp2.RequestHandler):
  def write_response(self, target_page, params={}):
    template = jinja_environment.get_template(target_page)
    content = template.render(params)
    self.response.out.write(content)

  def get(self):
    """Renders index.html."""
    checkIfRedirect(self);
    # Parse out parameters from request.
    params = get_room_parameters(self.request, None, None, None)
    # room_id/room_link will not be included in the returned parameters
    # so the client will show the landing page for room selection.
    self.write_response('index_template.html', params)

class RoomPage(webapp2.RequestHandler):
  def write_response(self, target_page, params={}):
    template = jinja_environment.get_template(target_page)
    content = template.render(params)
    self.response.out.write(content)

  def get(self, room_id):
    """Renders index.html or full.html."""
    checkIfRedirect(self)
    # Check if room is full.
    room = memcache.get(
        get_memcache_key_for_room(self.request.host_url, room_id))
    if room is not None:
      logging.info('Room ' + room_id + ' has state ' + str(room))
      if room.get_occupancy() >= 2:
        logging.info('Room ' + room_id + ' is full')
        self.write_response('full_template.html')
        return
    # Parse out room parameters from request.
    params = get_room_parameters(self.request, room_id, None, None)
    # room_id/room_link will be included in the returned parameters
    # so the client will launch the requested room.
    self.write_response('index_template.html', params)

class ParamsPage(webapp2.RequestHandler):
  def get(self):
    # Return room independent room parameters.
    params = get_room_parameters(self.request, None, None, None)
    self.response.write(json.dumps(params))

def checkIfRedirect(self):
  parsed_args = ''
  if self.request.headers['Host'] in constants.REDIRECT_DOMAINS:
    for argument in self.request.arguments():
      parameter = '=' + self.request.get(argument)
      if parsed_args == '':
        parsed_args += '?'
      else:
        parsed_args += '&'
      parsed_args += argument + parameter
    redirect_url = constants.REDIRECT_URL + self.request.path + parsed_args
    webapp2.redirect(redirect_url, permanent=True, abort=True)

app = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/a/', analytics_page.AnalyticsPage),
    ('/compute/(\w+)/(\S+)/(\S+)', compute_page.ComputePage),
    ('/join/([a-zA-Z0-9-_]+)', JoinPage),
    ('/leave/([a-zA-Z0-9-_]+)/([a-zA-Z0-9-_]+)', LeavePage),
    ('/message/([a-zA-Z0-9-_]+)/([a-zA-Z0-9-_]+)', MessagePage),
    ('/params', ParamsPage),
    ('/r/([a-zA-Z0-9-_]+)', RoomPage),
], debug=True)
