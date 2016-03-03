/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals TestCase, filterIceServersUrls, assertEquals, randomString,
   queryStringToDictionary */

'use strict';

var PEERCONNECTION_CONFIG = {
  iceServers: [
    {
      urls: [
        'turn:turn.example1.com',
        'turn:turn.example.com?transport=tcp',
        'turn:turn.example.com?transport=udp',
        'turn:turn.example1.com:8888',
        'turn:turn.example.com:8888?transport=tcp',
        'turn:turn.example.com:8888?transport=udp'
      ],
      username: 'username',
      credential: 'credential'
    },
    {
      urls: [
        'stun:stun.example1.com',
        'stun:stun.example.com?transport=tcp',
        'stun:stun.example.com?transport=udp',
        'stun:stun.example1.com:8888',
        'stun:stun.example.com:8888?transport=tcp',
        'stun:stun.example.com:8888?transport=udp'
      ]
    },
    {
      // This should not appear at all due to it being empty after filtering it.
      urls: [
       'stun:stun2.example.com?transport=tcp'
      ]
    }
  ]
};

var PEERCONNECTION_CONFIG_FILTERED = {
  iceServers: [
    {
      urls: [
        'turn:turn.example1.com?transport=udp',
        'turn:turn.example.com?transport=udp',
        'turn:turn.example1.com:8888?transport=udp',
        'turn:turn.example.com:8888?transport=udp'
      ],
      username: 'username',
      credential: 'credential'
    },
    {
      urls: [
        'stun:stun.example1.com?transport=udp',
        'stun:stun.example.com?transport=udp',
        'stun:stun.example1.com:8888?transport=udp',
        'stun:stun.example.com:8888?transport=udp'
      ]
    }
  ]
};

var UtilsTest = new TestCase('UtilsTest');

UtilsTest.prototype.testFilterIceServersUrls = function() {
  filterIceServersUrls(PEERCONNECTION_CONFIG, 'udp');
  assertEquals('Only transport=udp URLs should remain.',
      PEERCONNECTION_CONFIG_FILTERED, PEERCONNECTION_CONFIG);
};

UtilsTest.prototype.testRandomReturnsCorrectLength = function() {
  assertEquals('13 length string', 13, randomString(13).length);
  assertEquals('5 length string', 5, randomString(5).length);
  assertEquals('10 length string', 10, randomString(10).length);
};

UtilsTest.prototype.testRandomReturnsCorrectCharacters = function() {
  var str = randomString(500);

  // randromString should return only the digits 0-9.
  var positiveRe = /^[0-9]+$/;
  var negativeRe = /[^0-9]/;

  var positiveResult = positiveRe.exec(str);
  var negativeResult = negativeRe.exec(str);

  assertEquals(
      'Number only regular expression should match.',
      0, positiveResult.index);
  assertEquals(
      'Anything other than digits regular expression should not match.',
      null, negativeResult);
};

UtilsTest.prototype.testQueryStringToDictionary = function() {
  var dictionary = {
    'foo': 'a',
    'baz': '',
    'bar': 'b',
    'tee': '',
  };

  var buildQuery = function(data, includeEqualsOnEmpty) {
    var queryString = '?';
    for (var key in data) {
      queryString += key;
      if (data[key] || includeEqualsOnEmpty) {
        queryString += '=';
      }
      queryString += data[key] + '&';
    }
    queryString = queryString.slice(0, -1);
    return queryString;
  };

  // Build query where empty value is formatted as &tee=&.
  var query = buildQuery(dictionary, true);
  var result = queryStringToDictionary(query);
  assertEquals(JSON.stringify(dictionary), JSON.stringify(result));

  // Build query where empty value is formatted as &tee&.
  query = buildQuery(dictionary, false);
  result = queryStringToDictionary(query);
  assertEquals(JSON.stringify(dictionary), JSON.stringify(result));

  result = queryStringToDictionary('?');
  assertEquals(0, Object.keys(result).length);

  result = queryStringToDictionary('?=');
  assertEquals(0, Object.keys(result).length);

  result = queryStringToDictionary('?&=');
  assertEquals(0, Object.keys(result).length);

  result = queryStringToDictionary('');
  assertEquals(0, Object.keys(result).length);

  result = queryStringToDictionary('?=abc');
  assertEquals(0, Object.keys(result).length);
};
