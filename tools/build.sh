#!/bin/bash -e
########################################################
# This script generates a tarball containing all files,
# dependencies and the installed node binary.
########################################################
# Output is: ./builds/$VERSION/prey-$VERSION.tar.gz
########################################################

##### ENV VARS
if [ -z "${NODE_AGENT_UNIX_VER}" ]; then
	echo -e "NODE_AGENT_UNIX_VER env variable is not set"
	return 1
fi

if [ -z "${NODE_AGENT_WINDOWS_VER}" ]; then
	echo -e "NODE_AGENT_WINDOWS_VER env variable is not set"
	return 1
fi

abort() {
	echo "$1" && exit 1
}

build() {
	VERSION="$1"
	CURRENT_PATH="$(pwd)"
	SCRIPT_PATH="$(dirname $0)"

	if [ -n "$VERSION" ]; then
		echo "Building packages for version ${VERSION}."
	else
		echo "Defaulting to current version."
		VERSION=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("package.json","utf8")).version)')
		echo $VERSION
	fi

	[ -z "$VERSION" ] && abort "No version found!"

	DIST="$(pwd)/builds"
	ROOT="/tmp/prey-build.$$"
	FOLDER="prey-${VERSION}" # folder name within zip file

	VERSION_PATH="${DIST}/${VERSION}" # path to put new packages
	ZIP="prey-${VERSION}.zip"

	echo "Temp build directory set to ${ROOT}."
	mkdir -p "$ROOT/$FOLDER"
	cp -R package-lock.json README.md license.txt prey.conf.default package.json bin lib "$ROOT/$FOLDER"
	cd "$ROOT/$FOLDER"

	# https://github.com/TryGhost/node-sqlite3/issues/1552#issuecomment-1073309408
	npm config set python python3

	BUNDLE_ONLY=1 npm install --production # > /dev/null
	if [ $? -ne 0 ]; then
		abort "NPM install failed."
	fi

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

	zip_file

	pack mac x64
	pack mac arm64

	pack windows x86
	pack windows x64

	pack linux x64

	cd $DIST
}

zip_file() {
	OS="$1"
	echo -e "\nBuilding ${ZIP} package..."

	if [ -z "$OS" ]; then
		zip -9 -r "$ZIP" "$FOLDER" 1>/dev/null
	elif [ "$OS" = 'windows' ]; then
		rm -rf "$FOLDER/node_modules/sqlite3/build/Release/node_sqlite3.node"

		if [ "$ARCH" == "x86" ]; then
			cp -R "$CURRENT_PATH/tools/sqlite3/windows/napi-v6-win32-unknown-ia32/node_sqlite3.node" "$FOLDER/node_modules/sqlite3/build/Release/"
		fi
		if [ "$ARCH" == "x64" ]; then
			cp -R "$CURRENT_PATH/tools/sqlite3/windows/napi-v6-win32-unknown-x64/node_sqlite3.node" "$FOLDER/node_modules/sqlite3/build/Release/"
		fi
		zip -9 -r "$ZIP" "$FOLDER" -x \*.sh \*linux/* \*mac/* \*darwin/* 1>/dev/null

	elif [ "$OS" = 'mac' ]; then
		rm -rf "$FOLDER/node_modules/sqlite3/build/Release/node_sqlite3.node"
		if [ "$ARCH" == "x64" ]; then
			cp -R "$CURRENT_PATH/tools/sqlite3/mac/napi-v6-darwin-unknown-x64/node_sqlite3.node" "$FOLDER/node_modules/sqlite3/build/Release/"
		fi
		if [ "$ARCH" == "arm64" ]; then
			cp -R "$CURRENT_PATH/tools/sqlite3/mac/napi-v6-darwin-unknown-arm64/node_sqlite3.node" "$FOLDER/node_modules/sqlite3/build/Release/"
		fi
		zip -9 -r "$ZIP" "$FOLDER" -x \*.cmd \*.exe \*.dll \*windows/* \*linux/* 1>/dev/null
	elif [ "$OS" = 'linux' ]; then
		rm -rf "$FOLDER/node_modules/sqlite3/build/Release/node_sqlite3.node"
		cp -R "$CURRENT_PATH/tools/sqlite3/linux/napi-v6-linux-x64/node_sqlite3.node" "$FOLDER/node_modules/sqlite3/build/Release/"
		zip -9 -r "$ZIP" "$FOLDER" -x \*.cmd \*.exe \*.dll \*windows/* \*mac/* \*darwin/* 1>/dev/null
	fi

	mv "$ROOT/$ZIP" "$VERSION_PATH"
	echo "$VERSION_PATH/$ZIP"
}

pack() {
	OS="$1"
	ARCH="$2"
	ZIP="prey-${OS}-${VERSION}-${ARCH}.zip"
	NODE_BIN="node.${OS}"
	[ "$OS" = "windows" ] && NODE_BIN="node.exe"

	if [ "$OS" == "windows" ]; then
		cp "$CURRENT_PATH/node/${NODE_AGENT_WINDOWS_VER}/${ARCH}/${NODE_BIN}" "${ROOT}/${FOLDER}/bin"
	fi

	if [ "$OS" != "windows" ]; then
		cp "$CURRENT_PATH/node/${NODE_AGENT_UNIX_VER}/${ARCH}/${NODE_BIN}" "${ROOT}/${FOLDER}/bin"
		mv "${ROOT}/${FOLDER}/bin/node.${OS}" "${ROOT}/${FOLDER}/bin/node"
	fi

	zip_file $OS
	rm -f "${ROOT}/${FOLDER}/bin/node"
	rm -f "${ROOT}/${FOLDER}/bin/node.exe"
}

build $1

