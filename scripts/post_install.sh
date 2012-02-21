#!/bin/sh -e
# post install script for prey package
# run after npm install'ed

SCRIPT_PATH="$(dirname $0)"
# . "$SCRIPT_PATH/helper_functions.sh"

INSTALL_PATH="$1"
[ -z "$INSTALL_PATH" ] && INSTALL_PATH="$(pwd)"

download_deps(){

  local cwd=$(pwd)
  local root="$1"
  local npm=$(which npm)
  local dirname=$(which dirname)

  echo "Installing dependencies in ${root}..."

  for file in $(find "$root" -name package.json | grep -v "${root}/node_modules"); do
    path=$($dirname "$file")
    if [ "$path" != "$root" ]; then
      cd "$path"
      echo "Found package.json in ${path}"
      $npm install --production > /dev/null
    fi
  done
  
  cd "$cwd"

}

download_deps "$INSTALL_PATH"
[ -z "$BUNDLE_ONLY" ] && sh "$SCRIPT_PATH/create_user.sh"

exit 0
