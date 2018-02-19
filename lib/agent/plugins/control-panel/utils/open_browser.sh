#!/bin/sh

if [ "$1" = 'mac' ]; then
  CMD="open"
elif [ "$1" = 'windows' ]; then
  CMD="start"
elif [ "$1" = 'linux' ]; then
  CMD="x-www-browser"  
fi

echo $CMD $2

$CMD $2