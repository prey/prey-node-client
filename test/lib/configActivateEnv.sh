#!/bin/bash

#####################################################################
# TEST LIBRARY
#
# Prey Client
#
# Script to ... <TODO: Document this script>
#
#####################################################################

SRCPATH="$1"
DSTPATH="$2"

mkdir "${2}/node_modules"
cp -r "${1}/node_modules/." "${2}/node_modules/."

mkdir "${2}/lib"
cp -r "${1}/lib/." "${2}/lib/."

cp "${1}/prey.conf.default" "${2}/."
cp "${1}/package.json" "${2}/."

cp "${1}/test/lib/configActivateTester.js" "${2}/."
