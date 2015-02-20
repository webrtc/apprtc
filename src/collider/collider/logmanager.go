// Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file in the root of the source
// tree.

// Package collider implements a signaling server based on WebSocket.
package collider

import (
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"strings"
	"time"
)

// LogManager redirects log output to files, one for each |cycle|, and deletes files that are last modified before the retention period.
type LogManager struct {
	dir       string
	cycle     time.Duration
	retention time.Duration
	file      *os.File
	stopped   chan bool
	ticker    *time.Ticker
}

func NewLogManager(d string, c time.Duration, r time.Duration) *LogManager {
	if d == "" {
		log.Printf("Invalid log dir")
		return nil
	}
	if c >= r {
		log.Printf("Log retention time must be greater than log cycle")
		return nil
	}
	return &LogManager{
		dir:       d,
		cycle:     c,
		retention: r,
	}
}

func (lm *LogManager) Start() error {
	if lm.stopped != nil || lm.ticker != nil {
		log.Printf("Start called in invalid state")
		return errors.New("Invalid state")
	}

	lm.stopped = make(chan bool)
	lm.ticker = time.NewTicker(lm.cycle)
	go lm.runTicker()

	lm.startNewLog()
	return nil
}

func (lm *LogManager) Stop() {
	if lm.stopped != nil {
		lm.stopped <- true
		lm.stopped = nil
	}
	if lm.ticker != nil {
		lm.ticker.Stop()
		lm.ticker = nil
	}
	if lm.file != nil {
		lm.file.Close()
		lm.file = nil
	}
	log.SetOutput(os.Stderr)
}

func (lm *LogManager) IsLogFileName(n string) bool {
	ss := strings.Split(n, "_")
	if len(ss) != 5 {
		return false
	}
	if ss[0] != "log" {
		return false
	}
	return true
}

func (lm *LogManager) runTicker() {
	for {
		select {
		case <-lm.ticker.C:
			lm.startNewLog()
			lm.deleteOldLogs()
		case <-lm.stopped:
			return
		}
	}
}

func (lm *LogManager) logFileName() string {
	t := time.Now().UTC()
	// Use UniNano to differentiate logs created on the same day.
	return fmt.Sprintf("log_%d_%d_%d_%d", t.Month(), t.Day(), t.Year(), t.UnixNano())
}

func (lm *LogManager) startNewLog() {
	if err := os.MkdirAll(lm.dir, 0777); err != nil {
		log.Printf("MkdirAll error: %s", err.Error())
		return
	}

	if lm.file != nil {
		lm.file.Close()
		lm.file = nil
	}

	p := path.Join(lm.dir, lm.logFileName())
	f, err := os.OpenFile(p, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Printf("OpenFile error: %s", err.Error())
		return
	}

	lm.file = f
	log.SetOutput(lm.file)
}

func (lm *LogManager) deleteOldLogs() {
	fi, err := ioutil.ReadDir(lm.dir)
	if err != nil {
		log.Printf("Error from ioutil.ReadDir: %v", err)
		return
	}

	for i := range fi {
		if !lm.IsLogFileName(fi[i].Name()) {
			continue
		}
		if time.Now().Sub(fi[i].ModTime()) > lm.retention {
			log.Printf("Deleting stale log file %s", fi[i].Name())
			os.Remove(path.Join(lm.dir, fi[i].Name()))
		}
	}
}
