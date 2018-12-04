/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

/* exported uistats */

'use strict';

class Prop {
  constructor(label, {title, format}) {
    this.label = label;
    this.title = title;
    this._format = format || (x => x);
    this._valueEl = null; // <div>
  }

  _getValueElement() {
    if (this._valueEl)
      return this._valueEl;

    const container = $('#wasm-stats');
    const row = document.createElement('div');
    const label = document.createElement('div');
    const value = document.createElement('div');

    row.append(label);
    row.append(value);
    container.append(row);

    label.textContent = this.label;
    row.title = this.title;

    return this._valueEl = value;
  }

  set(value) {
    const el = this._getValueElement();
    el.textContent = this._format(value);
  }
}

class TimeProp {
  constructor(text, args) {
    args.format = x => x + ' ms';
    return new Prop(text, args);
  }
}

class SizeProp {
  constructor(text, args) {
    args.format = x => (x / 1024).toFixed(1) + ' KB';
    return new Prop(text, args);
  }
}

const uistats = {
  rgbFrame: new TimeProp('RGB Frame', {
    title: 'Time to encode RGB frame.',
  }),
  yuvFrame: new TimeProp('IVF Frame', {
    title: 'Time to decode IVF frame.',
  }),
  sentSize: new SizeProp('Sent Packet', {
    title: 'Size of the sent key-frame or delta-frame.'
  }),
  recvSize: new SizeProp('Recv Packet', {
    title: 'Size of the received key-frame or delta-frame.'
  }),
  encIvfFileSize: new SizeProp('IVF encoder file size', {
    title: 'Size of the /vpx-enc-ivf'
  }),
  decIvfFileSize: new SizeProp('IVF decoder file size', {
    title: 'Size of the /vpx-dec-ivf'
  }),
};
