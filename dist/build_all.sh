#!/bin/sh

version=$1

[ -z "$1" ] && echo "Version required." && exit 1
[ ! -d "./${version}" ] && echo "Directory not found!" && exit 1

if [ -d "mac" ]; then
  echo "Building OSX packages..."
  cd mac
  ./build.sh $version
  cd ..
fi

if [ -d "linux" ]; then
  echo "Building Linux packages..."
  cd linux
  ./build.sh $version
  cd ..
fi

if [ -d "windows" ]; then
  echo "Building Windows packages..."
  cd windows
 ./build.sh $version
  cd ..
fi
