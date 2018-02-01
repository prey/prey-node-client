#!/bin/sh

if [ "$1" = 'mac' ]; then
  CMD="open"
elif [ "$OS" = 'windows' ]; then
  CMD="start"
elif [ "$1" = 'linux' ]; then
  CMD="x-www-browser"  
fi

echo $CMD
$CMD $2