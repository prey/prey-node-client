#!/bin/sh -e
# This script generates a tarball containing all files, dependencies and the installed node binary.
# Output is: dist/prey-$VERSION.tar.gz

SCRIPT_PATH="$(dirname $0)"
# . "$SCRIPT_PATH/helper_functions.sh"

VERSION=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("package.json","utf8")).version)')
DIST="$(pwd)/dist"
ROOT="/tmp/prey-build.$$"
FOLDER="prey-${VERSION}"
PACKAGE="$FOLDER"
TARBALL="${PACKAGE}.tar.gz"
# [ $(uname) == 'Darwin' ] && PACKAGE="prey-mac-$FOLDER" || PACKAGE="prey-linux-$FOLDER"

rm -f "${DIST}/${TARBALL}" 2> /dev/null

mkdir -p "$ROOT/$FOLDER/node_modules"
cp -R README.md index.js default.options package.json bin lib scripts test "$ROOT/$FOLDER"
cd "$ROOT/$FOLDER"

BUNDLE_ONLY=1 npm install --production # > /dev/null
cd "$ROOT/$FOLDER"

# echo "Copying node binary..."
# cp `which node` bin

echo -e "\nBuilding tarball..."
cd "$ROOT"
tar czf "$TARBALL" "$FOLDER"

mkdir -p "$DIST"
cd "$DIST"
mv "$ROOT/$TARBALL" "$DIST"
echo "$DIST/$TARBALL"

rm -fr "$ROOT"
