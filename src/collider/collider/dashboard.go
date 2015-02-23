// Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file in the root of the source
// tree.

package collider

import (
	"sync"
	"time"
)

const maxErrLogLen = 128

type errEvent struct {
	Time time.Time `json:"t"`
	Err  string    `json:"e"`
}

type dashboard struct {
	lock sync.Mutex

	startTime time.Time

	totalWs       int
	totalRecvMsgs int
	totalSendMsgs int
	wsErrs        int
	httpErrs      int
}

type statusReport struct {
	UpTimeSec float64 `json:"upsec"`
	OpenWs    int     `json:"openws"`
	TotalWs   int     `json:"totalws"`
	WsErrs    int     `json:"wserrors"`
	HttpErrs  int     `json:"httperrors"`
}

func newDashboard() *dashboard {
	return &dashboard{startTime: time.Now()}
}

func (db *dashboard) getReport(rs *roomTable) statusReport {
	db.lock.Lock()
	defer db.lock.Unlock()

	upTime := time.Since(db.startTime)
	return statusReport{
		UpTimeSec: upTime.Seconds(),
		OpenWs:    rs.wsCount(),
		TotalWs:   db.totalWs,
		WsErrs:    db.wsErrs,
		HttpErrs:  db.httpErrs,
	}
}

func (db *dashboard) incrWs() {
	db.lock.Lock()
	defer db.lock.Unlock()
	db.totalWs += 1
}

func (db *dashboard) onWsErr(err error) {
	db.lock.Lock()
	defer db.lock.Unlock()

	db.wsErrs += 1
}

func (db *dashboard) onHttpErr(err error) {
	db.lock.Lock()
	defer db.lock.Unlock()

	db.httpErrs += 1
}
