#!/bin/sh -e
# This script generates a tarball containing all files, dependencies and the installed node binary.
# Output is: dist/prey-$VERSION.tar.gz

SCRIPT_PATH="$(dirname $0)"
. "$SCRIPT_PATH/helper_functions.sh"

VERSION=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("package.json","utf8")).version)')
DIST="$(pwd)/dist"
ROOT="/tmp/prey-build.$$"
FOLDER="prey-${VERSION}"
PACKAGE="$FOLDER"
# [ $(uname) == 'Darwin' ] && PACKAGE="prey-mac-$FOLDER" || PACKAGE="prey-linux-$FOLDER"

mkdir -p "$ROOT/$FOLDER/node_modules"
cp -R config.js.default package.json bin lib scripts "$ROOT/$FOLDER"
cd "$ROOT/$FOLDER"

download_deps "$ROOT/$FOLDER" 'bundle'
cd "$ROOT/$FOLDER"

echo "Copying node binary..."
cp `which node` bin

echo "Building tarball..."
cd "$ROOT"
tar czf "$PACKAGE.tar.gz" "$FOLDER"

mkdir -p "$DIST"
cd "$DIST"
mv "$ROOT/$FOLDER.tar.gz" "$DIST"
echo "$DIST/$FOLDER.tar.gz"

rm -fr "$ROOT"
