#!/bin/bash

SRC_DIR='src'
DEST_DIR='out/app_engine'

if [ ! -d "out" ]; then
  mkdir out
fi

if [ ! -d "$DEST_DIR" ]; then
  mkdir out/app_engine
fi

# Do not copy the /js files since they are already compiled into the output directory during Closure compiling.
cp -r $SRC_DIR/css $DEST_DIR/
cp -r $SRC_DIR/html $DEST_DIR/
cp -r $SRC_DIR/images $DEST_DIR/
cp -r $SRC_DIR/app_engine/bigquery $DEST_DIR/
cp -r $SRC_DIR/third_party $DEST_DIR/

# Copy the python, .yaml, and html template files.
find $SRC_DIR/app_engine -regex ".*\.\(py\|yaml\|html\)" -not -name '*test.py*' | xargs cp --target-directory=$DEST_DIR

