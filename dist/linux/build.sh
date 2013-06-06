#!/bin/bash

version=$1
[ -z "$version" ] && exit 1

make_deb() {

  local arch=$1
  [ -z $(which dpkg-deb) ] && return 1
  [ -z "$version" ] && return 1

  local zip="../${version}/prey-linux-${version}-${arch}.zip"
  local debian_arch="i386"
  test "$arch" = "x64" && debian_arch="amd64"

  if [ ! -f "$zip" ]; then
    echo " -- ZIP file not found: ${zip}"
    return 1
  fi

  echo " -- Building Debian v${version} package (${debian_arch})..."

  if [ ! -d prey ]; then
    unzip $zip -d .
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
  if [ "$deb_version" != "$version" ]; then
    echo ' !! Debian control file still says old version. Updating...'
    sed -i "s/Version:.*/Version: $version/" DEBIAN/control
    sed -i "s/VERSION=.*/VERSION='$version'/" DEBIAN/postinst
  fi

  sed -i "s/Architecture:.*/Architecture: $debian_arch/" DEBIAN/control

  # DEBIAN control, postrm, etc
  cp -R DEBIAN ./build/prey/

# # /etc
# mkdir -p ./build/prey/etc/init.d
# cp ../platform/linux/prey-trigger ./build/prey/etc/init.d
# chmod +x ./build/prey/etc/init.d/prey-trigger

# # /usr/share/applications: menu shortcut
# mkdir -p ./build/prey/usr/share/applications
# cp linux/prey-config.desktop ./build/prey/usr/share/applications

  # /usr/share/doc: changelog, copyright file, manual, etc
  mkdir -p ./build/prey/usr/share/doc/prey
  cp COPYRIGHT ./build/prey/usr/share/doc/prey/copyright

 # copy changelogs and gzip them
  cp CHANGES ./build/prey/usr/share/doc/prey
  cp CHANGES ./build/prey/usr/share/doc/prey/changelog.Debian
  gzip --best ./build/prey/usr/share/doc/prey/CHANGES
  gzip --best ./build/prey/usr/share/doc/prey/changelog.Debian

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

# remove previous stuff
rm -Rf build *.deb
make_deb x86
make_deb x64
mv *.deb "../${version}" 2> /dev/null
