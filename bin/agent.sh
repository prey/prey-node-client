#!/bin/sh
basedir=$(dirname "$0")

if [ -x "$basedir/node" ]; then
  "$basedir/node" "$basedir/../lib/agent/cli.js" "$@"
else
  node "$basedir/../lib/agent/cli.js" "$@"
fi
