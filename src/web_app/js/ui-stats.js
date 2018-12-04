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

class MovingAverage {
  constructor(length) {
    this.length = length;
    this.buffer = [];
    this.head = 0;
    this.sum = 0;
  }

  push(value) {
    this.sum += value;

    if (this.buffer.length == this.length)
      this.sum -= this.buffer[this.head];

    this.buffer[this.head++] = value;
    this.head %= this.length;
  }

  get() {
    return this.sum / this.buffer.length;
  }
}

class Prop {
  constructor(label, {title, format, malen}) {
    this.label = label;
    this.title = title;
    this._format = format || (x => x);
    this._valueEl = null; // <div>
    this._ma = new MovingAverage(malen || 30);
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
    this._ma.push(value);
    // Just el.textContent would create a new HTML element.
    (el.firstChild || el).textContent = this._format(this._ma.get());
  }
}

class TimeProp {
  constructor(text, args) {
    args.format = x => (x | 0) + ' ms';
    return new Prop(text, args);
  }
}

class SizeProp {
  constructor(text, args) {
    args.format = x => (x / 1024 | 0) + ' KB';
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
