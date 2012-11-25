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
  cp -R README.md index.js prey.conf.default package.json bin lib scripts spec "$ROOT/$FOLDER"

  cd "$ROOT/$FOLDER"

  # remove stuff from main tarball
  find . -name "*~" -delete
  find . -name "__MACOSX" -delete
  rm -f bin/node*

  BUNDLE_ONLY=1 npm install --production # > /dev/null

  cd "$ROOT"
  mkdir -p "$VERSION_PATH"

  zip_file
  pack windows
  pack linux
  pack mac

  rm -fr "$ROOT"

}

zip_file(){

  OS="$1"
  echo -e "\nBuilding ${ZIP} package..."

  if [ -z "$OS" ]; then
    zip -9 -r "$ZIP" "$FOLDER" 1> /dev/null
  elif [ "$OS" = 'windows' ]; then
  	zip -9 -r "$ZIP" "$FOLDER" -x \*.sh -x \*linux* -x \*mac* 1> /dev/null
  elif [ "$OS" = 'mac' ]; then
  	zip -9 -r "$ZIP" "$FOLDER" -x \*windows* -x \*.exe -x \*linux* 1> /dev/null
  elif [ "$OS" = 'linux' ]; then
  	zip -9 -r "$ZIP" "$FOLDER" -x \*windows* -x \*.exe -x \*mac* 1> /dev/null
  fi

  mv "$ROOT/$ZIP" "$VERSION_PATH"
  echo "$VERSION_PATH/$ZIP"
}

pack(){

  OS="$1"
  # OS_FOLDER="${ROOT}/${1}"
  ZIP="prey-${OS}-${VERSION}.zip"

  NODE_BIN="node.${OS}"
  [ "$OS" = "windows" ] && NODE_BIN="node.exe"

  cp "$CURRENT_PATH/node/current/${NODE_BIN}" "${ROOT}/${FOLDER}/bin"

  if [ "$OS" != "windows" ]; then
    mv "${ROOT}/${FOLDER}/bin/node.${OS}" "${ROOT}/${FOLDER}/bin/node"
  fi

  zip_file $OS
  rm -f "${ROOT}/${FOLDER}/bin/node*"

}


[ -z "$SKIP_TESTS" ] && run_specs || echo "Skipping tests!"
[ $? -eq 0 ] && build
