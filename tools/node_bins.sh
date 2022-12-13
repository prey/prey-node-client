#!/bin/bash

if [ -z "$(which curl)" ]; then
  echo "You need to have curl in your system."
  exit 1
fi

cwd=$(pwd)
node_path="$cwd/node"
base_url="http://nodejs.org/download"

# TODO: replace SHASUMS.txt with the new url in order to get the latest version.
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
  # local url="${base_url}/v${version}/${file}"
  local url="${base_url}/release/v${version}/${file}"

  local target_dir="${dest}/${dir}"
  local target_file="${dest}/${file}"

  if [ -f ${dest}/node.${os} ]; then
    echo "${dest}/node.${os} already there. Skipping..."
  fi

  echo "Fetching ${url}..."
  curl -L -o "$target_file" "$url" 
  [ $? -ne 0 ] && return 1

  # TODO: handle exceptions here
  tar -zvxf ${target_file} -C ${dest} 2> /dev/null

  mv ${target_dir}/bin/node ${dest}/node.${os}

  rm -Rf ${target_file}
  rm -Rf ${target_dir}
}

fetch_exe(){
  local version="$1"
  local file="$2"
  local dest="$3"

  local url="${base_url}/v${version}/${file}"

  curl "$url" -o node.exe
  mv node.exe "${dest}"
}

fetch(){

  if [[ -z "$1" || "$1" == "latest" ]]; then
    local version=$(get_latest_version)
    [ -z "$version" ] && echo "Couldn't fetch version" && return 1
  else
    local version="$1"
  fi

  local path86="${node_path}/${version}/x86"
  local path64="${node_path}/${version}/x64"
  local patharm64="${node_path}/${version}/arm64"

  [ -d "$path86" ] && echo "Version exists: ${version}" && return 1

  mkdir -p "$path86" 2> /dev/null
  mkdir -p "$path64" 2> /dev/null
  mkdir -p "$patharm64" 2> /dev/null

  fetch_tar $version "mac" "node-v${version}-darwin-x64" "$path64"
  fetch_tar $version "mac" "node-v${version}-darwin-arm64" "$patharm64"

  fetch_tar $version "linux" "node-v${version}-linux-x64" "$path64"

  fetch_exe $version "node.exe" "$path86"
  fetch_exe $version "x64/node.exe" "$path64"

  set_version $version
}

set_version(){

  local version="$1"
  [ ! -d "node/${version}" ] && echo "Version not found: ${version}" && return 1

  echo "Symlinking version ${version}."
  [[ "$(uname -m)" =~ 'arm64' ]] && type='arm64' || type='x64'
  [ "$(uname)" == 'Linux' ] && os='linux' || os='mac'

  echo "Arch: $type"  

  rm -f "${node_path}/current"
  rm -f "${cwd}/bin/node"
  rm -f "${cwd}/bin/node.exe"

  # ln -s ${node_path}/${version}/${type}/node.${os} bin/node
  ln -s "${node_path}/${version}/${type}" "${node_path}/current"
  ln -s "${node_path}/current/node.${os}" "bin/node"
  ln -s "${node_path}/current/node.exe" "bin/node.exe"
}

get_latest_installed() {
  local latest=$(get_installed | tail -1)
  echo $latest
}

get_installed() {
  # osx's sort does not have version sorting
  local sort_flags="-bt. -k1,1 -k2,2n -k3,3n -k4,4n -k5,5n"
  [ "$(uname)" == 'Linux' ] && sort_flags="-V"

  find ${node_path} -maxdepth 1 \
  | grep "[[:digit:]]$" \
  | sed "s/.*\/\([^\/]*\)/\1/"  \
  | sort ${sort_flags}
}

if [ "$1" == 'fetch' ]; then
  fetch "$2"
  exit $?
elif [ "$1" == 'list' ]; then
  [ "$2" == 'latest' ] && get_latest_installed || get_installed
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
  echo "Usage: [list|set|fetch] [version|latest]"
fi
