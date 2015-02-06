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
cp -r $SRC_DIR/*/css $DEST_DIR/
cp -r $SRC_DIR/*/html $DEST_DIR/
cp -r $SRC_DIR/*/images $DEST_DIR/
cp -r $SRC_DIR/app_engine/bigquery $DEST_DIR/
cp -r $SRC_DIR/third_party $DEST_DIR/

# The HTML template files must be put in the app_engine root.
mv $DEST_DIR/html/*_template.html $DEST_DIR

# Copy the python, .yaml files.
find $SRC_DIR/app_engine -iname "*.py" -not -iname '*test*.py*' | xargs -I {} cp {} $DEST_DIR/
find $SRC_DIR/app_engine -iname "*.yaml" | xargs -I {} cp {} $DEST_DIR/

# loopback.js is not compiled by Closure and needs to be copied separately.
mkdir $DEST_DIR/js
find $SRC_DIR/ -iname "loopback.js" | xargs -I {} cp {} $DEST_DIR/js/
