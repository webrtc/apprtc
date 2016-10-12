#
#  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
#
#  Use of this source code is governed by a BSD-style license
#  that can be found in the LICENSE file in the root of the source
#  tree.
#!/bin/sh

# Run with a default set of parameters
BINDIR=./browsers/bin
export BROWSER=${BROWSER-chrome}
export BVER=${BVER-stable}
BROWSERBIN=$BINDIR/$BROWSER-$BVER
OS="`uname`"
if [ ! -x $BROWSERBIN ]; then
  # Travis-multirunner only supports Linux (partial mac support exists)
  if [[ "$OSTYPE" =~ ^linux ]]; then
    echo "Installing browser"
    ./node_modules/travis-multirunner/setup.sh
  fi
fi
echo "Start unit tests using Karma and $BROWSER browser"
BROWSER_UPPER=$(echo "$BROWSER" | tr '[:lower:]' '[:upper:]')
# Only use travis-multirunner downloaded browsers on Linux.
if [[ "$OSTYPE" =~ ^linux ]]; then
  export ${BROWSER_UPPER}_BIN="$BROWSERBIN"
fi

./node_modules/karma-cli/bin/karma start karma.conf.js
