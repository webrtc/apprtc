#!/usr/bin/python2.4
#
# Copyright 2015 Google Inc. All Rights Reserved.

"""AppRTC Leave Handler

This module implements leaving a call.
"""

import logging
import json
import webapp2

import constants
import parameter_handling
import room as room_module
import util

class LeavePage(webapp2.RequestHandler):
  def post(self, room_id, client_id):
    result = room_module.remove_client_from_room(
        self.request.host_url, room_id, client_id)
    if result['error'] is None:
      logging.info('Room ' + room_id + ' has state ' + result['room_state'])