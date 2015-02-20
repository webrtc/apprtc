// Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file in the root of the source
// tree.

package main

import (
	"collider"
	"flag"
	"log"
	"time"
)

var tls = flag.Bool("tls", true, "whether TLS is used")
var port = flag.Int("port", 443, "The TCP port that the server listens on")
var roomSrv = flag.String("room-server", "https://apprtc.appspot.com", "The origin of the room server")
var logDir = flag.String("log-dir", "/collider/log", "The absolute path to the log directory")
var logRetention = flag.Uint("log-retention", 29, "The log retention time in days")

const day = time.Hour * 24

func main() {
	flag.Parse()

	lm := collider.NewLogManager(*logDir, day, day*time.Duration(*logRetention))
	lm.Start()
	defer lm.Stop()

	log.Printf("Starting collider: tls = %t, port = %d, room-server=%s, log-dir=%s", *tls, *port, *roomSrv, *logDir)

	c := collider.NewCollider(*roomSrv)
	c.Run(*port, *tls)
}
