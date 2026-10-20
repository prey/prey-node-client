#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

NODE_VER=22.23.0
NODE_TARBALL="node-v${NODE_VER}-linux-x64.tar.xz"
NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VER}"
NODE_SHA256=14d7de44f235534799f8b171a4050d9a6a4bc99c87e053a25d3d54afa580aa20

DOCKER=${DOCKER:-docker}
BUILDER_IMAGE=${PREY_RPM_BUILDER_IMAGE:-prey-rpm-builder:tw}
BUILD_NETWORK=${PREY_RPM_BUILD_NETWORK:-host}
RELEASE=${RELEASE:-1}

SUPPORT_FILES=(prey.wrapper prey-agent.service prey.sysusers prey.tmpfiles
               prey.sudoers prey-xhost prey-xhost.desktop)
APP_PATHS=(bin lib package.json package-lock.json prey.conf.default LICENSE README.md)

die() { echo "make-rpm: error: $*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }
warn() { echo "make-rpm: WARNING: $*" >&2; }

allow_dirty=0
force_container=0
while [ $# -gt 0 ]; do
  case "$1" in
    --allow-dirty) allow_dirty=1 ;;
    --container) force_container=1 ;;
    -h | --help) sed -n '2,/^set -euo/{/^set -euo/d;s/^# \{0,1\}//;p}' "$0"; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
  shift
done

[ "$(uname -m)" = x86_64 ] || die "must run on x86_64 (bundled node and sqlite3 are x86_64)"
[[ $RELEASE =~ ^[0-9A-Za-z._+]+$ ]] || die "invalid RELEASE: $RELEASE"
for tool in git tar xz curl sha256sum file find; do
  command -v "$tool" >/dev/null 2>&1 || die "missing host tool: $tool"
done

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null) || die "not inside a git checkout"
cd "$REPO"
DIST="$REPO/dist/rpm"

step "Checking git state"
dirty=$(git status --porcelain --untracked-files=all -- "${APP_PATHS[@]}" tools/sqlite3 packaging \
          ':(exclude)packaging/rpm/tests' ':(exclude)packaging/rpm/README.md')
if [ -n "$dirty" ]; then
  printf '%s\n' "$dirty" >&2
  [ "$allow_dirty" -eq 1 ] || die "uncommitted changes in packaged paths; commit them or pass --allow-dirty"
  warn "uncommitted changes above: app sources still come from HEAD, packaging/rpm files from the working tree"
fi
GITREV=$(git rev-parse --short=10 HEAD)
SDE=$(git log -1 --format=%ct HEAD)
export SOURCE_DATE_EPOCH="$SDE"

step "Fetching Node.js v$NODE_VER"
NODE_DIR="$REPO/node/v$NODE_VER"
mkdir -p "$NODE_DIR"
fetch() { # url dest
  [ -s "$2" ] && return 0
  echo "downloading $1"
  curl -fL --proto '=https' --tlsv1.2 --retry 3 -o "$2.part" "$1"
  mv -f "$2.part" "$2"
}
fetch "$NODE_BASE_URL/SHASUMS256.txt" "$NODE_DIR/SHASUMS256.txt"
fetch "$NODE_BASE_URL/$NODE_TARBALL" "$NODE_DIR/$NODE_TARBALL"
sumline=$(awk -v f="$NODE_TARBALL" '$2 == f' "$NODE_DIR/SHASUMS256.txt")
[ -n "$sumline" ] || die "$NODE_TARBALL not listed in SHASUMS256.txt"
(cd "$NODE_DIR" && printf '%s\n' "$sumline" | sha256sum -c --quiet -) \
  || die "checksum mismatch for $NODE_DIR/$NODE_TARBALL (delete it and retry)"
[ "${sumline%% *}" = "$NODE_SHA256" ] \
  || die "SHASUMS256.txt hash ${sumline%% *} differs from pinned NODE_SHA256"

TOOLCHAIN="$NODE_DIR/toolchain"
if [ "$("$TOOLCHAIN/bin/node" --version 2>/dev/null)" != "v$NODE_VER" ]; then
  rm -rf "$TOOLCHAIN"
  mkdir -p "$TOOLCHAIN"
  tar -xJf "$NODE_DIR/$NODE_TARBALL" -C "$TOOLCHAIN" --strip-components=1
fi
export PATH="$TOOLCHAIN/bin:$PATH"
[ "$(node --version)" = "v$NODE_VER" ] || die "toolchain node is not v$NODE_VER"
echo "toolchain: node $(node --version), npm $(npm --version)"

VERSION=$(git show HEAD:package.json | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).version')
[[ $VERSION =~ ^[0-9]+(\.[0-9]+)*$ ]] || die "unexpected version in package.json: $VERSION"
echo "prey $VERSION, git $GITREV, release $RELEASE"

step "Staging HEAD into dist/rpm/stage"
STAGE_ROOT="$DIST/stage"
STAGE="$STAGE_ROOT/prey-$VERSION"
rm -rf "$STAGE_ROOT"
mkdir -p "$STAGE"
git archive --format=tar HEAD -- "${APP_PATHS[@]}" | tar -x -C "$STAGE"

step "npm ci --omit=dev"
(
  cd "$STAGE"
  env GIT_TERMINAL_PROMPT=0 \
      GIT_CONFIG_COUNT=2 \
      GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=ssh://git@github.com/ \
      GIT_CONFIG_KEY_1=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_1=git@github.com: \
      BUNDLE_ONLY=1 \
      npm_config_cache="$DIST/npm-cache" \
      npm_config_update_notifier=false \
      npm ci --omit=dev --ignore-scripts --no-audit --no-fund
)

step "Installing prebuilt sqlite3 binding"
mkdir -p "$STAGE/node_modules/sqlite3/build/Release"
git cat-file blob HEAD:tools/sqlite3/linux/napi-v6-linux-x64/node_sqlite3.node \
  > "$STAGE/node_modules/sqlite3/build/Release/node_sqlite3.node"
(cd "$STAGE" && node -e "new (require('./node_modules/sqlite3').Database)(':memory:').close()") \
  || die "sqlite3 smoke test failed"

step "Stripping non-Linux and unneeded files"
(
  cd "$STAGE"
  find node_modules -name 'example*' -prune -exec rm -rf {} +
  find node_modules -name test -prune -exec rm -rf {} +
  find node_modules -name '*.txt' ! -iname 'licen[cs]e*' ! -iname 'copying*' ! -iname 'notice*' \
    -prune -exec rm -rf {} +
  find node_modules -type l ! -name _mocha -delete
  find . -name '*~' -prune -exec rm -rf {} +
  find . -name __MACOSX -prune -exec rm -rf {} +
  find . -name '.*' -type f -delete
  rm -f bin/node*
  find . \( -name '*.cmd' -o -name '*.exe' -o -name '*.dll' \) -prune -exec rm -rf {} +
  find . -mindepth 1 \( -path '*windows/*' -o -path '*mac/*' -o -path '*darwin/*' \) \
    -prune -exec rm -rf {} +
  rm -rf bin/prey-user bin/trinity \
         lib/agent/utils/Prey.app lib/agent/utils/prey-actions.app \
         lib/agent/actions/lock/linux/prey-lock-gtk3 lib/conf/panel/linux/prey-config-gtk3
  find . -mindepth 1 -type d -empty -delete
)
foreign=$(find "$STAGE" -type f -print0 | xargs -0 -r file -N -F '|' | grep -E '\|.*(Mach-O|PE32|MS-DOS executable)' || :)
[ -z "$foreign" ] || { printf '%s\n' "$foreign" >&2; die "Mach-O/PE binaries left in the payload"; }
other_arch=$(find "$STAGE" -type f -print0 | xargs -0 -r file -N -F '|' | grep -E '\| *ELF' | grep -v 'x86-64' || :)
[ -z "$other_arch" ] || { printf '%s\n' "$other_arch" >&2; die "non-x86-64 ELF files left in the payload"; }
for f in lib/agent/actions/lock/linux/prey-lock-gtk4 lib/conf/panel/linux/prey-config-gtk4 \
         lib/agent/actions/wipe/linux/wipe-linux lib/system/linux/prey-su \
         node_modules/sqlite3/build/Release/node_sqlite3.node; do
  [ -s "$STAGE/$f" ] || die "required file missing after stripping: $f"
done

step "Normalizing permissions"
find "$STAGE" -type d -exec chmod 0755 {} +
find "$STAGE" -type f -exec chmod 0644 {} +
while IFS= read -r -d '' f; do
  hdr=
  IFS= read -r -N 4 hdr <"$f" 2>/dev/null || :
  case "$hdr" in $'\x7f'ELF* | '#!'*) chmod 0755 "$f" ;; esac
done < <(find "$STAGE" -type f -print0)

step "Preparing rpmbuild tree"
TOPDIR="$DIST/rpmbuild"
rm -rf "$TOPDIR"
mkdir -p "$TOPDIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
XZ_OPT=-T0 tar --sort=name --mtime="@$SDE" --owner=0 --group=0 --numeric-owner \
  -cJf "$TOPDIR/SOURCES/prey-$VERSION-vendored.tar.xz" -C "$STAGE_ROOT" "prey-$VERSION"
cp "$NODE_DIR/$NODE_TARBALL" "$TOPDIR/SOURCES/"
for f in "${SUPPORT_FILES[@]}"; do cp "$SCRIPT_DIR/$f" "$TOPDIR/SOURCES/"; done
cp "$SCRIPT_DIR/prey.spec" "$TOPDIR/SPECS/"

rpmbuild_defs() { # topdir as seen by rpmbuild
  printf '%s\n' --define "_topdir $1" --define "pkg_version $VERSION" \
    --define "pkg_release $RELEASE" --define "gitrev $GITREV" \
    --define "_buildhost prey-rpm-builder" \
    --define "use_source_date_epoch_as_buildtime 1" \
    --define "build_mtime_policy clamp_to_source_date_epoch"
}
if [ "$force_container" -eq 0 ] && command -v rpmbuild >/dev/null 2>&1; then
  step "rpmbuild (host)"
  mapfile -t defs < <(rpmbuild_defs "$TOPDIR")
  rpmbuild -bb "${defs[@]}" "$TOPDIR/SPECS/prey.spec"
else
  command -v "$DOCKER" >/dev/null 2>&1 || die "no rpmbuild on the host and no '$DOCKER' to run it in a container"
  if ! "$DOCKER" image inspect "$BUILDER_IMAGE" >/dev/null 2>&1; then
    step "Building builder image $BUILDER_IMAGE"
    "$DOCKER" build --network "$BUILD_NETWORK" -t "$BUILDER_IMAGE" - <<'EOF'
FROM docker.io/opensuse/tumbleweed:latest
RUN zypper -n --gpg-auto-import-keys refresh \
 && zypper -n in --no-recommends rpm-build systemd-rpm-macros tar xz \
 && zypper -n clean -a
EOF
  fi
  step "rpmbuild (container $BUILDER_IMAGE)"
  mapfile -t defs < <(rpmbuild_defs /rpmbuild)
  "$DOCKER" run --rm --network none --user "$(id -u):$(id -g)" \
    -e HOME=/tmp -e SOURCE_DATE_EPOCH="$SDE" \
    -v "$TOPDIR:/rpmbuild:z" "$BUILDER_IMAGE" \
    rpmbuild -bb "${defs[@]}" /rpmbuild/SPECS/prey.spec
fi

shopt -s nullglob
rpms=("$TOPDIR"/RPMS/x86_64/prey-"$VERSION"-*.x86_64.rpm)
shopt -u nullglob
[ "${#rpms[@]}" -eq 1 ] || die "expected exactly one RPM in $TOPDIR/RPMS/x86_64"
RPM_FILE="$DIST/$(basename "${rpms[0]}")"
cp -f "${rpms[0]}" "$RPM_FILE"

rpmq() { # rpm query, on the host or in the builder container
  if command -v rpm >/dev/null 2>&1; then
    rpm "$@"
  else
    "$DOCKER" run --rm --network none -v "$DIST:/dist:z" "$BUILDER_IMAGE" \
      rpm "${@/#"$DIST"//dist}"
  fi
}
step "Dependencies of $(basename "$RPM_FILE")"
requires=$(rpmq -qp --requires "$RPM_FILE")
provides=$(rpmq -qp --provides "$RPM_FILE")
echo "--- Requires:";   printf '%s\n' "$requires"
echo "--- Recommends:"; rpmq -qp --recommends "$RPM_FILE"
echo "--- Provides:";   printf '%s\n' "$provides"
missing=
while read -r dep _; do
  case "$dep" in
    user\(* | group\(*)
      awk '{print $1}' <<<"$provides" | grep -qxF -- "$dep" || missing="$missing $dep" ;;
  esac
done <<<"$requires"
[ -z "$missing" ] || die "hard user/group requirement(s) not provided by the package:$missing"

echo "--- Files not owned by root:root:"
rpmq -qplv "$RPM_FILE" | awk '$3 != "root" || $4 != "root"'

step "Done"
ls -l "$RPM_FILE"
sha256sum "$RPM_FILE"
