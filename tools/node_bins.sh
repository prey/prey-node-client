#!/bin/bash

cwd=$(pwd)
node_path="$cwd/node"
base_url="https://nodejs.org/download"

get_latest_version() {
	local url="${base_url}/release/latest/SHASUMS256.txt"
	curl -s $url | grep "node-v" | head -1 | sed "s/.*node-v\([^\-]*\)-.*/\1/"
}

fetch_tar() {
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
	else
		echo "Fetching ${url}..."
		http_status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

		if [ "$http_status" -eq 404 ]; then
			echo "Error: URL ${url} returned 404 Not Found. Skipping download."
		fi
	fi
	curl -L -o "$target_file" "$url"
	[ $? -ne 0 ] && return 1
	tar -zvxf ${target_file} -C ${dest} 2>/dev/null
	if [[ $? -ne 0 ]]; then
		echo "An error occurred while extracting the archive."
	fi
	mv ${target_dir}/bin/node ${dest}/node.${os}
	rm -Rf ${target_file}
	rm -Rf ${target_dir}
}

fetch_exe() {
	local version="$1"
	local file="$2"
	local dest="$3"
	local url="${base_url}/release/v${version}/${file}"
	curl "$url" -o node.exe
	mv node.exe "${dest}"
}

fetch_unix() {
	fetch_linux $1 $2
	fetch_mac $1 $2 $3
}

fetch_linux() {
	check_create_path "$1" "$2"
	fetch_tar "$1" "linux" "node-v${1}-linux-x64" "$2"
}

fetch_mac() {
	check_create_path "$1" "$2"
	check_create_path "$1" "$3"
	fetch_tar "$1" "mac" "node-v${1}-darwin-x64" "$2"
	fetch_tar "$1" "mac" "node-v${1}-darwin-arm64" "$3"
}

fetch_win() {
	check_create_path "$1" "$2"
	check_create_path "$1" "$3"
	fetch_exe "$1" "win-x86/node.exe" "$2"
	fetch_exe "$1" "win-x64/node.exe" "$3"
}

check_create_path() {
	[ -d "$2" ] && echo "Version exists: ${1}" && return 1
	mkdir -p "$2" 2>/dev/null
}

fetch() {
	if [ -d "$node_path" ]; then
		echo "Node folder already exist."
	else
		mkdir "$node_path"
		echo "Node folder create at: $node_path"
	fi

	if [ -z "$(which curl)" ]; then
		echo "You need to have curl in your system."
		exit 1
	fi
	if [[ -z "$1" || "$1" == "latest" ]]; then
		local version=$(get_latest_version)
		[ -z "$version" ] && echo "Couldn't fetch version" && return 1
	else
		local version="$1"
	fi
	local path86="${node_path}/${version}/x86"
	local path64="${node_path}/${version}/x64"
	local patharm64="${node_path}/${version}/arm64"

	if [[ "$2" == "mac" ]]; then
		fetch_mac "$version" "$path64" "$patharm64"
	elif [[ "$2" == "linux" ]]; then
		fetch_linux "$version" "$path64"
	elif [[ "$2" == "unix" ]]; then
		fetch_unix "$version" "$path64" "$patharm64"
	elif [[ "$2" == "win" ]]; then
		fetch_win "$version" "$path86" "$path64"
	fi
}

get_installed() {
	# osx's sort does not have version sorting
	local sort_flags="-bt. -k1,1 -k2,2n -k3,3n -k4,4n -k5,5n"
	[ "$(uname)" == 'Linux' ] && sort_flags="-V"
	find ${node_path} -maxdepth 1 |
		grep "[[:digit:]]$" |
		sed "s/.*\/\([^\/]*\)/\1/" |
		sort ${sort_flags}
}

if [ "$1" == 'fetch' ] && [[ "$3" =~ ^(win|mac|unix|linux)$ ]]; then
	fetch "$2" "$3"
	exit $?
elif [ "$1" == 'list' ]; then
	get_installed
else
	echo "Usage: [list|fetch] [version|latest] [win|linux|mac|unix]"
fi

