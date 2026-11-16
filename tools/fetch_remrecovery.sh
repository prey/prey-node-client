#!/bin/bash
# fetch_remrecovery.sh — downloads remrecovery from the matching goprey release
# for this environment and stages it under tools/remrecovery/<os>/<arch>/ so
# build.sh can bundle it. On Linux it also fetches the detached Ed25519 signature
# (the ELF binaries are not code-signed).
#
# Each asset is downloaded from the URL the release publishes (like
# fetch_companions in goprey): that way it uses downloads.preyproject.com for
# prod and downloads-stg for beta without hardcoding the host.
#
# Environment (from GitLab CI, or exported locally for testing):
#   ENV             prod | stg | test   (stg/test -> goprey beta tag)
#   CI_API_V4_URL   e.g. https://gitlab.preyhq.com/api/v4   (only if GOPREY_VERSION is unset)
#   CI_JOB_TOKEN    pipeline token                           (only if GOPREY_VERSION is unset)
# Optional override:
#   GOPREY_VERSION  pins the version (without 'v'); skips the API, downloads from prod, no token.
set -euo pipefail

GOPREY_PROJECT="prey%2Fgo%2Fgoprey"
OUT="tools/remrecovery"
ENVNAME="${ENV:-prod}"

# 1) Resolve the release: prod -> latest vX.Y.Z; beta (stg/test) -> latest vX.Y.Z-beta.
if [ -n "${GOPREY_VERSION:-}" ]; then
  VERSION="$GOPREY_VERSION"
  MODE="prod-url"
else
  API="${CI_API_V4_URL:?CI_API_V4_URL required (or set GOPREY_VERSION)}"
  TOKEN="${CI_JOB_TOKEN:?CI_JOB_TOKEN required (or set GOPREY_VERSION)}"
  case "$ENVNAME" in
    prod) RE='^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
    *)    RE='^v[0-9]+\.[0-9]+\.[0-9]+-beta$' ;;
  esac
  RELEASE_JSON=$(curl --silent --fail --header "JOB-TOKEN: ${TOKEN}" \
    "${API}/projects/${GOPREY_PROJECT}/releases?per_page=50" \
    | jq -c --arg re "$RE" '[.[] | select(.tag_name | test($re))][0] // empty')
  test -n "$RELEASE_JSON" || { echo "ERROR: no goprey release found for ENV=$ENVNAME"; exit 1; }
  TAG=$(jq -r '.tag_name' <<<"$RELEASE_JSON")
  VERSION="${TAG#v}"
  MODE="api"
fi
echo "remrecovery: using goprey ${VERSION} (ENV=$ENVNAME, MODE=$MODE)"

PRODBASE="https://downloads.preyproject.com/prey-client-releases/goprey/${VERSION}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

# URL of an asset by name: from the release (api) or rebuilt from prod (override).
asset_url() {
  if [ "$MODE" = "api" ]; then
    jq -r --arg n "$1" '.assets.links[] | select(.name==$n) | .url' <<<"$RELEASE_JSON" | head -1
  else
    echo "${PRODBASE}/$1"
  fi
}
# Download asset $1 to $2.
dl() {
  local url; url="$(asset_url "$1")"
  test -n "$url" || { echo "ERROR: asset $1 is not in the goprey release"; exit 1; }
  curl -fsSL -o "$2" "$url"
}

dl "checksums.txt" "$WORK/checksums.txt"

# Verify $1 (local path) against checksums.txt by its basename.
verify_sha() {
  local f="$1" name; name="$(basename "$f")"
  local want; want=$(grep -E " \./${name}\$| ${name}\$" "$WORK/checksums.txt" | awk '{print $1}' | head -1)
  test -n "$want" || { echo "ERROR: $name is not in checksums.txt"; exit 1; }
  echo "${want}  ${f}" | sha256sum --check --status || { echo "ERROR: sha256 mismatch for $name"; exit 1; }
}

rm -rf "$OUT"; mkdir -p "$OUT"/{windows/x86,windows/x64,mac/x64,mac/arm64,linux/x64}

# 2a) Windows: standalone binaries.
for a in x86 x64; do
  f="prey-recovery-${VERSION}-${a}.exe"
  dl "$f" "$WORK/$f"; verify_sha "$WORK/$f"
  cp "$WORK/$f" "$OUT/windows/$a/remrecovery.exe"
done

# 2b) macOS: inside the darwin zip (x64->amd64, arm64->arm64).
for pair in "x64:amd64" "arm64:arm64"; do
  na="${pair%%:*}"; ga="${pair##*:}"
  z="prey-darwin-${VERSION}-${ga}.zip"
  dl "$z" "$WORK/$z"; verify_sha "$WORK/$z"
  unzip -p "$WORK/$z" "PreyAgent.app/Contents/MacOS/remrecovery" > "$OUT/mac/$na/remrecovery"
  chmod 0755 "$OUT/mac/$na/remrecovery"
done

# 2c) Linux x64: inside the linux zip + detached Ed25519 signature.
z="prey-linux-${VERSION}-amd64.zip"
dl "$z" "$WORK/$z"; verify_sha "$WORK/$z"
unzip -p "$WORK/$z" "remrecovery" > "$OUT/linux/x64/remrecovery"
chmod 0755 "$OUT/linux/x64/remrecovery"
dl "prey-recovery-linux-${VERSION}-amd64.sig" "$OUT/linux/x64/remrecovery.sig"

# Verify the Linux binary against its detached Ed25519 signature with the goprey
# updater public key, so CI never ships a mismatched binary/.sig pair: Node is
# fail-closed and a mismatch would make every Linux migrate return
# recovery_binary_untrusted. OpenSSL 3 in the CI image supports -rawin.
PUBKEY="$WORK/goprey-updater.pub"
cat > "$PUBKEY" <<'EOF'
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAenBd/Yx/AKrbbzixs+mvzZNRHyE6BiG4W+CSACDaumI=
-----END PUBLIC KEY-----
EOF
if ! openssl pkeyutl -verify -pubin -inkey "$PUBKEY" -rawin \
  -in "$OUT/linux/x64/remrecovery" -sigfile "$OUT/linux/x64/remrecovery.sig"; then
  echo "ERROR: remrecovery signature does not match the bundled Linux binary"
  exit 1
fi

echo "remrecovery staged:"; find "$OUT" -type f | sort
