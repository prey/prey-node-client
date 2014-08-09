#!/bin/sh -e
########################################################
# This script generates a tarball containing all files,
# dependencies and the installed node binary.
########################################################
# Output is: ./builds/$VERSION/prey-$VERSION.tar.gz
########################################################

if [ "$1" = "new" ]; then
  new_release=1
fi

run_specs(){
  echo "Ensuring we have the latest packages..."
  npm install
  bin/prey test --recursive --bail --reporter dot
}

abort() {
  echo "$1" && exit 1
}

cleanup() {
  cd $CURRENT_PATH
  git checkout $current_branch
  [ -n "$new_release" ] && rollback_release
}

create_release() {
  # increase version number and add git tag
  npm version patch
}

rollback_release() {
  git reset --hard HEAD~1
  git tag -d $NEW_TAG
}

get_current_branch() {
  git branch --no-color 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/'
}

does_tag_exist(){
  git tag | grep "$1" > /dev/null && echo 1
}

git_modified_files() {
  git status | grep modified | wc -l
}

build(){

  CURRENT_PATH="$(pwd)"
  SCRIPT_PATH="$(dirname $0)"

  if [ -n "$new_release" ]; then
    NEW_TAG=$(create_release)
    if [ $? -ne 0 ]; then
      echo "Unable to create new release.".
      exit 1
    fi
    echo "New release: ${NEW_TAG}"
    VERSION="${NEW_TAG:1}" # remove the leading 'v'
  elif [ -n "$VERSION" ]; then
    echo "Building packages for version ${VERSION}."
  else
    echo "Defaulting to current version."
    VERSION=$(bin/node -e 'console.log(JSON.parse(require("fs").readFileSync("package.json","utf8")).version)')
  fi

  [ -z "$VERSION" ] && abort "No version found!"
  [ -z "$(does_tag_exist v${VERSION})" ] && abort "Tag not found: v${VERSION}"

  local current_branch=$(get_current_branch)
  git checkout v${VERSION}

  DIST="$(pwd)/builds"
  ROOT="/tmp/prey-build.$$"

  FOLDER="prey-${VERSION}"
  VERSION_PATH="${DIST}/${VERSION}"
  ZIP="prey-${VERSION}.zip"

  mkdir -p "$ROOT/$FOLDER"
  cp -R npm-shrinkwrap.json README.md license.txt prey.conf.default package.json bin lib "$ROOT/$FOLDER"

  cd "$ROOT/$FOLDER"

  BUNDLE_ONLY=1 npm install --production # > /dev/null
  if [ $? -ne 0 ]; then
    echo "NPM install failed. Reverting changes..."
    cleanup
    return 1
  fi

  rm -f npm-shrinkwrap.json

  # remove stuff from main tarball
  rm -Rf $(find node_modules -name "example*")
  rm -Rf $(find node_modules -name "test")
  rm -Rf $(find node_modules -name "*.txt")
  find . -name "*~" -delete
  find . -name "__MACOSX" -delete
  find . -name "\.*" -delete # remove .gitignore .travis.yml .DS_Store, etc
  rm -f bin/node*

  cd "$ROOT"
  echo "Generating output dir: ${VERSION_PATH}"
  rm -Rf "$VERSION_PATH"
  mkdir -p "$VERSION_PATH"

  echo "OK, ready to go. Press any key to continue."
  read keypress

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
  cleanup

}

zip_file(){

  OS="$1"
  echo -e "\nBuilding ${ZIP} package..."

  if [ -z "$OS" ]; then
    zip -9 -r "$ZIP" "$FOLDER" 1> /dev/null
  elif [ "$OS" = 'windows' ]; then
    zip -9 -r "$ZIP" "$FOLDER" -x \*.sh \*linux/* \*mac/* \*darwin/* 1> /dev/null
  elif [ "$OS" = 'mac' ]; then
    zip -9 -r "$ZIP" "$FOLDER" -x \*.cmd \*.exe \*.dll \*windows/* \*linux/* 1> /dev/null
  elif [ "$OS" = 'linux' ]; then
    zip -9 -r "$ZIP" "$FOLDER" -x \*.cmd \*.exe \*.dll \*windows/* \*mac/* \*darwin/* 1> /dev/null
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

if [ "$(git_modified_files)" -gt 0 ]; then 
  abort "Tree contains changes. Please commit or stash to avoid losing data."
elif [ -z "$SKIP_TESTS" ]; then
  run_specs && build
else
  echo "Skipping tests. You cheatin'?"
  build
fi
