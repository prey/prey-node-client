#!/bin/bash

version=$1

make_deb() {

  local arch=$1
  [ -z $(which dpkg-deb) ] && return 1
  [ -z "$version" ] && return 1

  echo " -- Building Debian v${version} package..."

  # remove previous stuff
  rm -Rf build *.deb

  if [ ! -d prey ]; then
    unzip ../${version}/prey-linux-${version}-${arch}.zip -d .
    mv prey-${version} prey
  fi

  # remove unneeded files
  find . -name "*~" -delete
  find prey -empty -delete
  rm -Rf $(find prey -name "windows")
  rm -Rf $(find prey -name "darwin")
  rm -Rf $(find prey -name "mac")

  versions_path="/usr/lib/prey/versions"
  mkdir -p build/prey${versions_path}
  mv prey build/prey${versions_path}/${version}

  local deb_version=$(grep "Version:" DEBIAN/control | cut -d" " -f2)
  if [ "$deb_version" != "$version-ubuntu2" ]; then
    echo ' !! Debian control file still says old version. Updating...'
    sed -i "s/Version:.*/Version: $version-ubuntu2/" DEBIAN/control
    sed -i "s/VERSION=.*/VERSION=$version/" DEBIAN/postinst
  fi

  # DEBIAN control, postrm, etc
  cp -R DEBIAN ./build/prey/

# # /etc
# mkdir -p ./build/prey/etc/init.d
# cp ../platform/linux/prey-trigger ./build/prey/etc/init.d
# chmod +x ./build/prey/etc/init.d/prey-trigger

# # /usr/share/applications: menu shortcut
# mkdir -p ./build/prey/usr/share/applications
# cp linux/prey-config.desktop ./build/prey/usr/share/applications

# # /usr/share/doc: changelog, copyright file, manual, etc
# mkdir -p ./build/prey/usr/share/doc/prey
# cp ../COPYRIGHT ./build/prey/usr/share/doc/prey/copyright

# # copy changelogs and gzip them
# cp linux/CHANGES ./build/prey/usr/share/doc/prey
# cp linux/changelog.Debian ./build/prey/usr/share/doc/prey
# gzip --best ./build/prey/usr/share/doc/prey/CHANGES
# gzip --best ./build/prey/usr/share/doc/prey/changelog.Debian

  # ensure permissions
  chmod g-w ./build/prey -R

  # set ownership to root to pass lintian check
  sudo chown root.root build/prey -R

  # Make the deb package
  sudo dpkg-deb -b ./build/prey ./build

  mv ./build/*.deb .

  # remove debian build dir
  sudo rm -Rf build

}

make_deb x86
