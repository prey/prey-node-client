#!/bin/bash -e
########################################################
# This script generates a tarball containing all files,
# dependencies and the installed node binary.
########################################################
# Output is: ./builds/$VERSION/prey-$VERSION.tar.gz
########################################################

if [ "$1" = "new" ]; then
  new_release=1
fi

[ $(uname) = 'Darwin' ] && is_mac=1

abort() {
  echo "$1" && exit 1
}

cleanup() {
  cd $CURRENT_PATH
  [ -n "$ROOT" ] && rm -Rf "$ROOT"
  [ -n "$CURRENT_BRANCH" ] && git checkout $CURRENT_BRANCH
  [ -n "$NEW_TAG" ] && rollback_release
}

run_specs(){
  echo "Ensuring we have the latest packages..."
  BUNDLE_ONLY=1 npm install
  bin/prey test lib/agent/plugins --recursive --bail --reporter dot
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

check_node_version() {
  EXPECTED_NODE_VER="16.18.0"

  CURRENT_NODE_VER="$(./bin/node --version)"
  
  if [ "v${EXPECTED_NODE_VER}" != "$CURRENT_NODE_VER" ]; then
    echo "Looks like your node version in bin is outdated: ${CURRENT_NODE_VER}"
    echo "Please update to v${EXPECTED_NODE_VER} using the 'tools/node_bins.sh' script"
    abort "Stopping here."
  fi
}

sign_bin() {
  bin=$1
  codesign -f --deep -s "Developer ID Application: Prey, Inc." $bin
}

check_code_signatures() {

  # make sure there are no extended attributes in path
  xattr -rc .

  local alert="lib/agent/actions/alert/darwin/flash.py"
  local lock="lib/agent/actions/lock/mac/prey-lock"
  local gui="lib/conf/gui/mac/PreyConfig.app"

  # for bin in $alert $lock $gui; do 
  for bin in $gui; do
    echo "Verifying code signature of ${bin}..."
    codesign -dv $bin 2> /dev/null || (sign_bin $bin && codesign -dv $bin)

    if [ $? -ne 0 ]; then
      echo "Invalid code signature: ${bin}"
      return 1
    fi
  done

  return 0
}

build() {

  VERSION="$1"
  CURRENT_PATH="$(pwd)"
  SCRIPT_PATH="$(dirname $0)"

  if [ -n "$new_release" ]; then
    NEW_TAG=$(create_release)
    [ $? -ne 0 ] && abort "Unable to create new release.".

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

  CURRENT_BRANCH=$(get_current_branch)
  # TODO: uncomment line below
  # git checkout v${VERSION}

  DIST="$(pwd)/builds"
  ROOT="/tmp/prey-build.$$"
  FOLDER="prey-${VERSION}" # folder name within zip file

  # if we're building a temp version, mark package versions as prerelease
  [ -n "$NEW_TAG" ] && VERSION="${VERSION}pre"

  VERSION_PATH="${DIST}/${VERSION}" # path to put new packages
  ZIP="prey-${VERSION}.zip"

  echo "Temp build directory set to ${ROOT}."
  mkdir -p "$ROOT/$FOLDER"
  cp -R npm-shrinkwrap.json README.md license.txt prey.conf.default package.json bin lib "$ROOT/$FOLDER"
  cd "$ROOT/$FOLDER"

  # https://github.com/TryGhost/node-sqlite3/issues/1552#issuecomment-1073309408
  npm config set python python3
  
  BUNDLE_ONLY=1 npm install --production # > /dev/null
  if [ $? -ne 0 ]; then
    abort "NPM install failed."
  fi

  rm -f npm-shrinkwrap.json

  # remove stuff from main tarball
  echo "Stripping unneeded stuff..."
  rm -Rf $(find node_modules -name "example*")
  rm -Rf $(find node_modules -name "test")
  rm -Rf $(find node_modules -name "*.txt")
  rm -Rf $(find node_modules/ -type l \! -name "_mocha") # remove all symlinks in node_modules except for _mocha
  find . -name "*~" -delete
  find . -name "__MACOSX" -delete
  find . -name "\.*" -type f -delete # remove .gitignore .travis.yml .DS_Store, etc
  rm -f bin/node*

  cd "$ROOT"
  echo "Generating output dir: ${VERSION_PATH}"
  rm -Rf "$VERSION_PATH"
  mkdir -p "$VERSION_PATH"

  echo "OK, ready to go. Press any key to continue."
  read keypress

  zip_file

  [ -n "$is_mac" ] && pack mac x64
  [ -n "$is_mac" ] && pack mac arm64

  pack windows x86
  pack windows x64

  pack linux x64

  cd $DIST
  # ./checksum.sh $VERSION
}

zip_file(){

  OS="$1"
  echo -e "\nBuilding ${ZIP} package..."

  if [ -z "$OS" ]; then
    zip -9 -r "$ZIP" "$FOLDER" 1> /dev/null
  elif [ "$OS" = 'windows' ]; then
    if [ "$ARCH" == "x86" ]; then
      rm -rf "$FOLDER/node_modules/sqlite3/lib/binding/napi-v3-darwin-x64"
      cp -R "$CURRENT_PATH/tools/sqlite3/windows/napi-v3-win32-ia32" "$FOLDER/node_modules/sqlite3/lib/binding/"
      cp -R "$CURRENT_PATH/tools/sqlite3/windows/napi-v3-win32-x64" "$FOLDER/node_modules/sqlite3/lib/binding/"
    fi
    zip -9 -r "$ZIP" "$FOLDER" -x \*.sh \*linux/* \*mac/* \*darwin/* 1> /dev/null

  elif [ "$OS" = 'mac' ]; then
    if [ "$ARCH" == "x86" ]; then
      rm -rf "$FOLDER/node_modules/sqlite3/lib/binding/napi-v3-darwin-x64"
      cp -R "$CURRENT_PATH/tools/sqlite3/mac/napi-v3-darwin-x64" "$FOLDER/node_modules/sqlite3/lib/binding/"
    fi

    # if [ -n "$is_mac" ]; then
    #   ditto -v -c -k --zlibCompressionLevel 9 --rsrc --extattr --noqtn --keepParent "$FOLDER" "$ZIP"
    # else
    #   echo "Warning: Not creating OSX packages as files would lose their extended attributes."
    zip -9 -r "$ZIP" "$FOLDER" -x \*.cmd \*.exe \*.dll \*windows/* \*linux/* 1> /dev/null
    # fi
  elif [ "$OS" = 'linux' ]; then
    if [ "$ARCH" == "x86" ]; then
      unzip -q "$CURRENT_PATH/tools/sqlite3/linux/sqlite3.zip" -d "$CURRENT_PATH/tools/sqlite3/linux"
      rm -rf "$FOLDER/node_modules/sqlite3"
      cp -R "$CURRENT_PATH/tools/sqlite3/linux/sqlite3" "$FOLDER/node_modules/"
    fi

    zip -9 -r "$ZIP" "$FOLDER" -x \*.cmd \*.exe \*.dll \*windows/* \*mac/* \*darwin/* 1> /dev/null

    if [ "$ARCH" == "x64" ]; then
      rm -rf "$CURRENT_PATH/tools/sqlite3/linux/sqlite3"
    fi
  fi

  mv "$ROOT/$ZIP" "$VERSION_PATH"
  echo "$VERSION_PATH/$ZIP"
}

pack(){

  OS="$1"
  ARCH="$2"
  ZIP="prey-${OS}-${VERSION}-${ARCH}.zip"

  NODE_AGENT_VER=$(readlink ${CURRENT_PATH}/node/current | tr "\/" " " | awk '{print $(NF-1)}')
  if [ -z "${NODE_AGENT_VER}" ]; then 
    echo -e "node is not present in current ${CURRENT_PATH}/node/current"
    return 1
  fi

  NODE_BIN="node.${OS}"
  [ "$OS" = "windows" ] && NODE_BIN="node.exe"

  cp "$CURRENT_PATH/node/${NODE_AGENT_VER}/${ARCH}/${NODE_BIN}" "${ROOT}/${FOLDER}/bin"

  if [ "$OS" != "windows" ]; then
    mv "${ROOT}/${FOLDER}/bin/node.${OS}" "${ROOT}/${FOLDER}/bin/node"
  fi

  zip_file $OS

  rm -f "${ROOT}/${FOLDER}/bin/node"
  rm -f "${ROOT}/${FOLDER}/bin/node.exe"

}

# TODO: uncomment the line below
# if [ "$(git_modified_files)" -gt 0 ]; then
#   abort "Tree contains changes. Please commit or stash to avoid losing data."
# fi

# ensure node version matches the expected one
check_node_version

# TODO: verify signature is returning permission denied
# [ -n "$is_mac" ] && check_code_signatures

trap cleanup EXIT

# TODO: uncomment line below
# if [ -z "$SKIP_TESTS" ]; then
#   run_specs && build $1
# else
#   echo "Skipping tests. You cheatin'?"
#   build $1
# fi

# TODO: remove this line. just for testing
build $1