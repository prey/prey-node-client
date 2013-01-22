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

  CURRENT_PATH="$(pwd)"
  SCRIPT_PATH="$(dirname $0)"
  VERSION=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("package.json","utf8")).version)')

  DIST="$(pwd)/dist"
  ROOT="/tmp/prey-build.$$"

  FOLDER="prey-${VERSION}"
  VERSION_PATH="${DIST}/${VERSION}"
  ZIP="prey-${VERSION}.zip"

  rm -Rf "${VERSION_PATH}" 2> /dev/null

  mkdir -p "$ROOT/$FOLDER"
  cp -R README.md license.txt index.js prey.conf.default package.json bin lib scripts test "$ROOT/$FOLDER"

  cd "$ROOT/$FOLDER"

  BUNDLE_ONLY=1 npm install --production # > /dev/null

  # remove stuff from main tarball
  rm -Rf $(find node_modules -name "example*")
  rm -Rf $(find node_modules -name "test")
  rm -Rf $(find node_modules -name "*.txt")
  find . -name "*~" -delete
  find . -name "__MACOSX" -delete
  rm -f bin/node*

  cd "$ROOT"
  mkdir -p "$VERSION_PATH"

  zip_file
  pack windows x86
  pack linux x86
  pack mac x86

  pack windows x64
  pack linux x64
  pack mac x64

  rm -fr "$ROOT"
  cd $DIST
  # ./checksum.sh $VERSION
  cd $CURRENT_PATH

}

zip_file(){

  OS="$1"
  echo -e "\nBuilding ${ZIP} package..."

  if [ -z "$OS" ]; then
    zip -9 -r "$ZIP" "$FOLDER" 1> /dev/null
  elif [ "$OS" = 'windows' ]; then
    zip -9 -r "$ZIP" "$FOLDER" -x \*.sh -x \*linux* -x \*mac* 1> /dev/null
  elif [ "$OS" = 'mac' ]; then
    zip -9 -r "$ZIP" "$FOLDER" -x \*.exe -x \*windows* -x \*linux* 1> /dev/null
  elif [ "$OS" = 'linux' ]; then
    zip -9 -r "$ZIP" "$FOLDER" -x \*.exe -x \*windows* -x \*mac* 1> /dev/null
  fi

  mv "$ROOT/$ZIP" "$VERSION_PATH"
  echo "$VERSION_PATH/$ZIP"
}

pack(){

  OS="$1"
  ARCH="$2"
  ZIP="prey-${OS}-${VERSION}-${ARCH}.zip"

  NODE_VER=$(readlink ${CURRENT_PATH}/node/current | tr "\/" " " | awk '{print $(NF-1)}')
  [ -z "${NODE_VER}" ] && return 1

  NODE_BIN="node.${OS}"
  [ "$OS" = "windows" ] && NODE_BIN="node.exe"

  cp "$CURRENT_PATH/node/${NODE_VER}/${ARCH}/${NODE_BIN}" "${ROOT}/${FOLDER}/bin"

  if [ "$OS" != "windows" ]; then
    mv "${ROOT}/${FOLDER}/bin/node.${OS}" "${ROOT}/${FOLDER}/bin/node"
  fi

  zip_file $OS
  rm -f "${ROOT}/${FOLDER}/bin/node*"

}

if [ -z "$SKIP_TESTS" ]; then
  run_specs && build
else
  echo "Skipping tests!"
  build
fi
