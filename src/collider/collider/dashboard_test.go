// Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file in the root of the source
// tree.

package collider

import (
	"collidertest"
	"errors"
	"log"
	"reflect"
	"testing"
	"time"
)

func createNewRoomTable() *roomTable {
	return newRoomTable(time.Second, "")
}

func verifyIntValue(t *testing.T, i interface{}, name string, expected int, tag string) {
	v := reflect.ValueOf(i)
	f := v.FieldByName(name)
	if f.Interface() != expected {
		log.Printf("interface=%#v", i)
		t.Errorf("%s is %d, want %d", tag, f.Interface(), expected)
	}
}

func verifyStringValue(t *testing.T, i interface{}, name string, expected string, tag string) {
	v := reflect.ValueOf(i)
	f := v.FieldByName(name)
	if f.Interface() != expected {
		log.Printf("interface=%#v", i)
		t.Errorf("%s is %d, want %d", tag, f.Interface(), expected)
	}
}

func verifyArrayLen(t *testing.T, i interface{}, name string, expected int, tag string) {
	v := reflect.ValueOf(i)
	f := v.FieldByName(name)
	if f.Len() != expected {
		log.Printf("interface=%#v", i)
		t.Errorf("%s is %d, want %d", tag, f.Len(), expected)
	}
}

func TestDashboardWsCount(t *testing.T) {
	rt := createNewRoomTable()
	db := newDashboard()
	r := db.getReport(rt)
	if r.OpenWs != 0 {
		t.Errorf("db.getReport().OpenWs is %d, want 0", r.OpenWs)
	}
	if r.TotalWs != 0 {
		t.Errorf("db.getReport().TotalWs is %d, want 0", r.TotalWs)
	}

	db.incrWs()
	r = db.getReport(rt)
	if r.OpenWs != 0 {
		t.Errorf("db.getReport().OpenWs is %d, want 0", r.OpenWs)
	}
	if r.TotalWs != 1 {
		t.Errorf("db.getReport().TotalWs is %d, want 1", r.TotalWs)
	}

	rt.register("r", "c", &collidertest.MockReadWriteCloser{Closed: false})
	r = db.getReport(rt)
	if r.OpenWs != 1 {
		t.Errorf("db.getReport().OpenWs is %d, want 1", r.OpenWs)
	}
}

func TestDashboardWsErr(t *testing.T) {
	rt := createNewRoomTable()
	db := newDashboard()
	r := db.getReport(rt)
	if r.WsErrs != 0 {
		t.Errorf("db.getReport().WsErrs is %d, want 0", r.WsErrs)
	}

	db.onWsErr(errors.New("Fake error"))
	r = db.getReport(rt)
	if r.WsErrs != 1 {
		t.Errorf("db.getReport().WsErrs is %d, want 1", r.WsErrs)
	}
}

func TestDashboardHttpErr(t *testing.T) {
	rt := createNewRoomTable()
	db := newDashboard()
	r := db.getReport(rt)
	if r.HttpErrs != 0 {
		t.Errorf("db.getReport().HttpErrs is %d, want 0", r.HttpErrs)
	}
	db.onHttpErr(errors.New("Fake error"))
	r = db.getReport(rt)
	if r.HttpErrs != 1 {
		t.Errorf("db.getReport().HttpErrs is %d, want 1", r.HttpErrs)
	}
}
