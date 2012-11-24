#!/bin/sh -e
########################################################
# This script generates a tarball containing all files,
# dependencies and the installed node binary.
########################################################
# Output is: dist/prey-$VERSION.tar.gz
########################################################

run_specs(){
  npm test
}

build(){

  SCRIPT_PATH="$(dirname $0)"
  VERSION=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("package.json","utf8")).version)')
  DIST="$(pwd)/dist"
  ROOT="/tmp/prey-build.$$"
  FOLDER="${VERSION}"
  PACKAGE="$FOLDER"
  TARBALL="prey-${PACKAGE}.zip"
  # [ $(uname) == 'Darwin' ] && PACKAGE="prey-mac-$FOLDER" || PACKAGE="prey-linux-$FOLDER"

  rm -f "${DIST}/${TARBALL}" 2> /dev/null

  mkdir -p "$ROOT/$FOLDER/node_modules"
  cp -R README.md index.js prey.conf.default package.json bin lib scripts spec "$ROOT/$FOLDER"
  cd "$ROOT/$FOLDER"

  BUNDLE_ONLY=1 npm install --production # > /dev/null
  cd "$ROOT/$FOLDER"

  # echo "Copying node binary..."
  # cp `which node` bin

  echo -e "\nBuilding tarball..."
  cd "$ROOT"
  # tar czf "$TARBALL" "$FOLDER"
  zip -9 -r "$TARBALL" "$FOLDER"

  mkdir -p "$DIST"
  cd "$DIST"
  mv "$ROOT/$TARBALL" "$DIST"
  echo "$DIST/$TARBALL"

  rm -fr "$ROOT"

}

[ -z "$SKIP_TESTS" ] && run_specs || echo "Skipping tests!"
[ $? -eq 0 ] && build
