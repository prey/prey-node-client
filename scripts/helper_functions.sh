#!/bin/bash

download_deps(){

  local cwd=$(pwd)
  local root="$1"
  local npm=$(which npm)
  local dirname=$(which dirname)
  [ -n "$2" ] && export BUNDLE_ONLY=1

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