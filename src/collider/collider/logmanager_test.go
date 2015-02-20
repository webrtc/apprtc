// Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file in the root of the source
// tree.

package collider

import (
	"io/ioutil"
	"log"
	"os"
	"path"
	"strings"
	"testing"
	"time"
)

const cycle = time.Millisecond * 100
const retention = time.Millisecond * 500

func startInTempDir(t *testing.T) (*LogManager, string) {
	dir := path.Join(os.TempDir(), "collider_log")
	log.Printf("Log dir is %s", dir)
	os.RemoveAll(dir)

	lm := NewLogManager(dir, cycle, retention)
	if err := lm.Start(); err != nil {
		t.Errorf("LogManager.Start returns error %v, want nil", err)
		return nil, dir
	}
	return lm, dir
}

func TestLogManagerNew(t *testing.T) {
	lm := NewLogManager("", time.Second, time.Second*2)
	if lm != nil {
		t.Errorf("NewLogManager returns non nil, want nil")
	}

	lm = NewLogManager("bar", time.Second, time.Second)
	if lm != nil {
		t.Errorf("NewLogManager returns non nil, want nil")
	}

	lm = NewLogManager("bar", time.Second*2, time.Second)
	if lm != nil {
		t.Errorf("NewLogManager returns non nil, want nil")
	}
}

func TestLogManagerStartTwice(t *testing.T) {
	path := path.Join(os.TempDir(), "collider_log")
	lm := NewLogManager(path, cycle, retention)
	if err := lm.Start(); err != nil {
		t.Errorf("LogManager.Start returns error %v, want nil", err)
		return
	}
	defer lm.Stop()

	if err := lm.Start(); err == nil {
		t.Errorf("LogManager.Start twice returns nil, want error for invalid state")
		return
	}
}

func TestLogManagerLogFileCreated(t *testing.T) {
	lm, dir := startInTempDir(t)
	msg := "hello"
	log.Printf(msg)
	lm.Stop()

	fi, err := ioutil.ReadDir(dir)

	if err != nil {
		t.Errorf("ioutil.ReadDir returns error %v, want nil", err)
		return
	}
	if len(fi) != 1 {
		t.Errorf("Log dir has %d files, want 1", len(fi))
		return
	}

	buf, err := ioutil.ReadFile(path.Join(dir, fi[0].Name()))
	if err != nil {
		t.Errorf("ioutil.ReadFile returns error %v, want nil", err)
		return
	}
	s := string(buf)
	if !strings.Contains(s, msg) {
		t.Errorf("Log file content is %s, want containing %s", s, msg)
	}
}

func TestLogManagerOldLogFileDeleted(t *testing.T) {
	lm, dir := startInTempDir(t)
	time.Sleep(retention * 2)
	lm.Stop()

	fi, err := ioutil.ReadDir(dir)

	if err != nil {
		t.Errorf("ioutil.ReadDir returns error %v, want nil", err)
		return
	}
	l := len(fi)
	log.Printf("%d log files found", l)

	if l <= 1 {
		t.Errorf("Log dir has %d files, want > 1", l)
		return
	}

	for i := range fi {
		age := time.Now().Sub(fi[i].ModTime())
		if age > retention {
			t.Errorf("Stale log file found, age=%d, retension=%d", age, retention)
		}
	}
}
