/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals describe, expect, it, filterIceServersUrls, randomString,
   queryStringToDictionary */

'use strict';

describe('Utils test', function() {
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
        // This should not appear at all due to it being empty after filtering
        // it.
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

  it('filter Ice Servers URLS', function() {
    filterIceServersUrls(PEERCONNECTION_CONFIG, 'udp');
    // Only transport=udp URLs should remain.'
    expect(PEERCONNECTION_CONFIG).toEqual(PEERCONNECTION_CONFIG_FILTERED);
  });

  it('random Returns Correct Length', function() {
    expect(randomString(13).length).toEqual(13);
    expect(randomString(5).length).toEqual(5);
    expect(randomString(10).length).toEqual(10);
  });

  it('random Returns Correct Characters', function() {
    var str = randomString(500);

    // randomString should return only the digits 0-9.
    var positiveRe = /^[0-9]+$/;
    var negativeRe = /[^0-9]/;

    var positiveResult = positiveRe.exec(str);
    var negativeResult = negativeRe.exec(str);

    expect(positiveResult.index).toEqual(0);
    expect(negativeResult).toBeNull();
  });

  it('query String To Dictionary', function() {
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
    expect(JSON.stringify(result)).toEqual(JSON.stringify(dictionary));

    // Build query where empty value is formatted as &tee&.
    query = buildQuery(dictionary, false);
    result = queryStringToDictionary(query);
    expect(JSON.stringify(result)).toEqual(JSON.stringify(dictionary));

    result = queryStringToDictionary('?');
    expect(Object.keys(result).length).toEqual(0);

    result = queryStringToDictionary('?=');
    expect(Object.keys(result).length).toEqual(0);

    result = queryStringToDictionary('?&=');
    expect(Object.keys(result).length).toEqual(0);

    result = queryStringToDictionary('');
    expect(Object.keys(result).length).toEqual(0);

    result = queryStringToDictionary('?=abc');
    expect(Object.keys(result).length).toEqual(0);
  });
});
