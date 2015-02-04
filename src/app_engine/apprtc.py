#!/usr/bin/python2.4
#
# Copyright 2011 Google Inc. All Rights Reserved.

"""WebRTC Demo

This module demonstrates the WebRTC API by implementing a simple video chat app.
"""

# Enables loading third_party modules
import cgi
import json
import logging
import os
import random
import threading

import jinja2
import webapp2

from google.appengine.api import memcache
from google.appengine.api import urlfetch

import constants
import decline_page
import gcm_register
import gcmrecord
import join_page
import leave_page
import message_page
import parameter_handling
import room as room_module
import util

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))

class MainPage(webapp2.RequestHandler):
  def write_response(self, target_page, params={}):
    template = jinja_environment.get_template(target_page)
    content = template.render(params)
    self.response.out.write(content)

  def get(self):
    """Renders index.html."""
    # Parse out parameters from request.
    params = parameter_handling.get_room_parameters(self.request, None, None, None)
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
    # Check if room is full.
    room = memcache.get(
        room_module.get_memcache_key_for_room(self.request.host_url, room_id))
    if room is not None:
      logging.info('Room ' + room_id + ' has state ' + str(room))
      if room.get_occupancy() >= 2:
        logging.info('Room ' + room_id + ' is full')
        self.write_response('full_template.html')
        return
    # Parse out room parameters from request.
    params = parameter_handling.get_room_parameters(self.request, room_id, None, None)
    # room_id/room_link will be included in the returned parameters
    # so the client will launch the requested room.
    self.write_response('index_template.html', params)

class ParamsPage(webapp2.RequestHandler):
  def get(self):
    # Return room independent room parameters.
    params = parameter_handling.get_room_parameters(self.request, None, None, None)
    self.response.write(json.dumps(params))

app = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/decline/(\w+)', decline_page.DeclinePage),
    ('/join/(\w+)', join_page.JoinPage),
    ('/leave/(\w+)/(\w+)', leave_page.LeavePage),
    ('/leave/(\w+)', leave_page.LeaveDirectCallPage),
    ('/message/(\w+)/(\w+)', message_page.MessagePage),
    ('/params', ParamsPage),
    ('/register/(\w+)', gcm_register.BindPage),
    ('/r/(\w+)', RoomPage),
    # TODO(jiayl): Remove the deprecated API when Android is updated.
    ('/bind/(\w+)', gcm_register.BindPage),
], debug=True)
