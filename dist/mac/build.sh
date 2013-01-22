#!/bin/sh

make_pkg() {

 [ -z "$(which packagesbuild)" ] && return 1
 [ -z "$1" ] && return 1

 local version="$1"
 local arch="$2"
 local name="prey-mac-${version}-${arch}"
 local file="${name}.zip"
 local zip="../${version}/${file}"

 [ ! -f "${zip}" ] && return 1

 # remove old stuff
 rm -f *.pkg
 rm -Rf versions/

 # fetch package and unzip
 cp "$zip" .
 unzip $file
 rm -f $file

 # update version in post install script
 sed -i -e "s/^VERSION.*/VERSION='${version}'/" post_install.sh 
 rm -f post_install.sh-e 2> /dev/null

 mkdir versions 2> /dev/null
 mv prey-${version} "versions/${version}"
 packagesbuild -v prey-installer.pkgproj
 
 # rename file
 mv *.pkg ../${version}/${name}.pkg
 rm -Rf versions/

}

rm -Rf out
mkdir out
make_pkg $1 x86
make_pkg $1 x64
