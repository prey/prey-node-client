#!/bin/sh -e
# post install script for prey package
# run after npm install'ed

[ -n "$BUNDLE_ONLY" ] && exit 0

SCRIPT_PATH="$(dirname $0)"
. "$SCRIPT_PATH/helper_functions.sh"

INSTALL_PATH="$1"
[ -z "$INSTALL_PATH" ] && INSTALL_PATH="$(pwd)"

download_deps "$INSTALL_PATH"
sh "$SCRIPT_PATH/create_user.sh"
