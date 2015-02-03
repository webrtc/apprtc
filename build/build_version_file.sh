#!/bin/bash

commit=$(git log -1 | grep commit | sed 's/^commit *//')

date=$(git log -1 | grep Date | sed  's/^Date: *//')

branch=$(git branch | grep '* ' | sed 's/^\* *//')

dest='out/app_engine/version_info.json'

if [ ! -d "out" ]; then
  mkdir out
fi

if [ ! -d "out/app_engine" ]; then
  mkdir out/app_engine
fi

echo "{" >$dest

echo " \"gitHash\": \"$commit\", " >>$dest
echo " \"time\": \"$date\", " >>$dest
echo " \"branch\": \"$branch\"" >>$dest

echo "}" >>$dest
