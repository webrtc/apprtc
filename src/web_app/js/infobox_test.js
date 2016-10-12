/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* globals describe, it, expect, InfoBox */

'use strict';

describe('Infobox test', function() {
  it('Format bitrate', function() {
    expect(InfoBox.formatBitrate_(789)).toEqual('789 bps');
    expect(InfoBox.formatBitrate_(78912)).toEqual('78.9 kbps');
    expect(InfoBox.formatBitrate_(7891234)).toEqual('7.89 Mbps');
  });

  it('Format interval', function() {
    expect(InfoBox.formatInterval_(1999)).toEqual('00:01');
    expect(InfoBox.formatInterval_(12500)).toEqual('00:12');
    expect(InfoBox.formatInterval_(83123)).toEqual('01:23');
    expect(InfoBox.formatInterval_(754000)).toEqual('12:34');
    expect(InfoBox.formatInterval_(5025000)).toEqual('01:23:45');
    expect(InfoBox.formatInterval_(45296000)).toEqual('12:34:56');
    expect(InfoBox.formatInterval_(445543000)).toEqual('123:45:43');
  });
});
