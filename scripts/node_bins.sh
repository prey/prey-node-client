#!/bin/bash

cwd=$(pwd)
base_url="http://nodejs.org/dist"

get_latest_version(){
  local url="${base_url}/latest/SHASUMS.txt"
  curl -s $url | grep "node-v" | head -1 | sed "s/.*node-v\([^\-]*\)-.*/\1/"
}

fetch_tar(){
  local version="$1"
  local os="$2"
  local dir="$3"
  local dest="$4"

  local file="${dir}.tar.gz"
  local url="${base_url}/v${version}/${file}"

  local target_dir="${dest}/${dir}"
  local target_file="${dest}/${file}"

  echo "Fetching ${url}..."
  wget "$url" # -o "$target"
  [ $? -ne 0 ] && return 1

  mv ${file} ${target_file}

  tar -zvxf ${target_file} -C ${dest}
  mv ${target_dir}/bin/node ${dest}/node.${os}

  rm -Rf ${target_file}
  rm -Rf ${target_dir}
}

fetch_exe(){
  local version="$1"
  local file="$2"
  local dest="$3"

  local url="${base_url}/v${version}/${file}"

  wget "$url"
  mv node.exe "${dest}"
}

fetch(){

  if [ -n "$1" ]; then
    local version="$1"
  else
    local version=$(get_latest_version)
    [ -z "$version" ] && echo "Couldn't fetch version" && return 1
  fi

  local path86="${cwd}/node/${version}/x86"
  local path64="${cwd}/node/${version}/x64"

  [ -d "$path86" ] && echo "Version exists: ${version}" && return 1

  mkdir -p "$path86" 2> /dev/null
  mkdir -p "$path64" 2> /dev/null

  fetch_tar $version "mac" "node-v${version}-darwin-x86" "$path86"
  fetch_tar $version "mac" "node-v${version}-darwin-x64" "$path64"

  fetch_tar $version "linux" "node-v${version}-linux-x86" "$path86"
  fetch_tar $version "linux" "node-v${version}-linux-x64" "$path64"

  fetch_exe $version "node.exe" "$path86"
  fetch_exe $version "x64/node.exe" "$path64"

}

set_version(){

  local version="$1"
  [ ! -d "node/${version}" ] && echo "Version not found: ${version}" && return 1

  echo "Symlinking version ${version}."
  [ "$(uname -m)" == 'i686' ] && type='x86' || type='x64'
  [ "$(uname)" == 'Linux' ] && os='linux' || os='mac'

  rm -f "${cwd}/node/current"
  rm -f "${cwd}/bin/node"
  # ln -s ${cwd}/node/${version}/${type}/node.${os} bin/node
  ln -s "${cwd}/node/${version}/${type}" "${cwd}/node/current"
  ln -s "${cwd}/node/current/node.${os}" "bin/node"

}

get_latest_installed() {
  local latest=$(find node/ -maxdepth 1 | sed "s/[^0-9\.]//g" | grep -v "^$" | sort -r | tail -1)
  echo $latest
}

if [ "$1" == 'fetch' ]; then
  fetch "$2"
  exit $?
elif [ "$1" == 'set' ]; then
  if [ -n "$2" ]; then
    if [ "$2" == "latest" ]; then
      set_version $(get_latest_installed)
    else
      set_version "$2"
    fi
  else
    echo $(readlink "bin/node")
  fi
else
  echo "Usage: [fetch|set] [version]"
fi
