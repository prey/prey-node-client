#!/bin/bash

download_deps(){

  local cwd=$(pwd)
  local root="$1"
  local npm=$(which npm)
  local dirname=$(which dirname)
  [ -n "$2" ] && export BUNDLE_ONLY=1

  echo "Bundling package.json dependencies in ${root}..."

  for file in $(find "$root" -name package.json | grep -v node_modules); do 
    path=$($dirname "$file")
    cd "$path"
    # echo $path
    $npm install --production > /dev/null  
  done
  
  cd "$cwd"

}