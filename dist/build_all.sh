#!/bin/sh

version=$1

[ -z "$1" ] && echo "Version required." && exit 1
[ ! -d "./${version}" ] && echo "Directory not found!" && exit 1

echo "Building OSX packages..."
cd mac
./build.sh $version
cd ..

echo "Building Linux packages..."
cd linux
./build.sh $version
cd ..

#
# Commenting Windows package making. We need to run
# a portion of the process in a windows machine.
#
# echo "Building Windows packages..."
# cd windows
# ./build.sh $version
# cd ..

