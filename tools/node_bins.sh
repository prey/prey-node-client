#!/bin/bash
if [ -z "$(which curl)" ]; then
  echo "You need to have curl in your system."
  exit 1
fi
cwd=$(pwd)
node_path="$cwd/node"
base_url="https://nodejs.org/download"
get_latest_version(){
  local url="${base_url}/release/latest/SHASUMS256.txt"
  curl -s $url | grep "node-v" | head -1 | sed "s/.*node-v\([^\-]*\)-.*/\1/"
}
fetch_tar(){
  local version="$1"
  local os="$2"
  local dir="$3"
  local dest="$4"
  local file="${dir}.tar.gz"
  local url="${base_url}/release/v${version}/${file}"
  local target_dir="${dest}/${dir}"
  local target_file="${dest}/${file}"
  if [ -f ${dest}/node.${os} ]; then
    echo "${dest}/node.${os} already there. Skipping..."
  fi
  echo "Fetching ${url}..."
  curl -L -o "$target_file" "$url" 
  [ $? -ne 0 ] && return 1
  tar -zvxf ${target_file} -C ${dest} 2> /dev/null
  if [[ $? -ne 0 ]]; then
    echo "An error occurred while extracting the archive."
    exit 1
  fi
  mv ${target_dir}/bin/node ${dest}/node.${os}
  rm -Rf ${target_file}
  rm -Rf ${target_dir}
}
fetch_exe(){
  local version="$1"
  local file="$2"
  local dest="$3"
  local url="${base_url}/release/v${version}/${file}"
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
  [ -d "$path64" ] && echo "Version exists: ${version}" && return 1
  [ -d "$patharm64" ] && echo "Version exists: ${version}" && return 1
  mkdir -p "$path86" 2> /dev/null
  mkdir -p "$path64" 2> /dev/null
  mkdir -p "$patharm64" 2> /dev/null
  fetch_tar $version "mac" "node-v${version}-darwin-x64" "$path64"
  fetch_tar $version "mac" "node-v${version}-darwin-arm64" "$patharm64"
  fetch_tar $version "linux" "node-v${version}-linux-x64" "$path64"
  fetch_exe $version "win-x86/node.exe" "$path86"
  fetch_exe $version "win-x64/node.exe" "$path64"
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
  get_installed
else
  echo "Usage: [list|fetch] [version|latest]"
fi