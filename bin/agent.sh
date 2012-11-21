#!/bin/sh
basedir=$(dirname "$0")

if [ -x "$basedir/node" ]; then
  "$basedir/node" "$basedir/prey.js" "$@"
else
  node "$basedir/prey.js" "$@"
fi
