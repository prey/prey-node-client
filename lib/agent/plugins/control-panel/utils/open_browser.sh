#!/bin/sh

if [ "$1" = 'mac' ]; then
  CMD="open"
  DETACHED=""
elif [ "$1" = 'windows' ]; then
  CMD="start"
  DETACHED=""
elif [ "$1" = 'linux' ]; then
  CMD="xdg-open"
  DETACHED="</dev/null &>/dev/null &"
fi

$CMD $2 $DETACHED