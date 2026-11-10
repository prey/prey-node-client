#!/bin/bash
# fetch_remrecovery.sh — baja remrecovery del release de goprey correspondiente
# al entorno y lo deja en tools/remrecovery/<os>/<arch>/ para que build.sh lo
# empaquete. En Linux adjunta además la firma Ed25519 (los ELF no van firmados).
#
# Baja cada asset por la URL que publica el release (como fetch_companions en
# goprey): así usa downloads.preyproject.com para prod y downloads-stg para
# beta sin hardcodear el host.
#
# Entorno (de GitLab CI, o export local para pruebas):
#   ENV             prod | stg | test   (stg/test -> tag beta de goprey)
#   CI_API_V4_URL   ej. https://gitlab.preyhq.com/api/v4   (solo si no se fija GOPREY_VERSION)
#   CI_JOB_TOKEN    token del pipeline                      (solo si no se fija GOPREY_VERSION)
# Override opcional:
#   GOPREY_VERSION  fija la versión (sin 'v'); salta la API, baja de producción, sin token.
set -euo pipefail

GOPREY_PROJECT="prey%2Fgo%2Fgoprey"
OUT="tools/remrecovery"
ENVNAME="${ENV:-prod}"

# 1) Resolver release: prod -> último vX.Y.Z; beta (stg/test) -> último vX.Y.Z-beta.
if [ -n "${GOPREY_VERSION:-}" ]; then
  VERSION="$GOPREY_VERSION"
  MODE="prod-url"
else
  API="${CI_API_V4_URL:?CI_API_V4_URL requerido (o fija GOPREY_VERSION)}"
  TOKEN="${CI_JOB_TOKEN:?CI_JOB_TOKEN requerido (o fija GOPREY_VERSION)}"
  case "$ENVNAME" in
    prod) RE='^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
    *)    RE='^v[0-9]+\.[0-9]+\.[0-9]+-beta$' ;;
  esac
  RELEASE_JSON=$(curl --silent --fail --header "JOB-TOKEN: ${TOKEN}" \
    "${API}/projects/${GOPREY_PROJECT}/releases?per_page=50" \
    | jq -c --arg re "$RE" '[.[] | select(.tag_name | test($re))][0] // empty')
  test -n "$RELEASE_JSON" || { echo "ERROR: no hay release de goprey para ENV=$ENVNAME"; exit 1; }
  TAG=$(jq -r '.tag_name' <<<"$RELEASE_JSON")
  VERSION="${TAG#v}"
  MODE="api"
fi
echo "remrecovery: usando goprey ${VERSION} (ENV=$ENVNAME, MODE=$MODE)"

PRODBASE="https://downloads.preyproject.com/prey-client-releases/goprey/${VERSION}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

# URL de un asset por nombre: del release (api) o reconstruida de prod (override).
asset_url() {
  if [ "$MODE" = "api" ]; then
    jq -r --arg n "$1" '.assets.links[] | select(.name==$n) | .url' <<<"$RELEASE_JSON" | head -1
  else
    echo "${PRODBASE}/$1"
  fi
}
# Descarga el asset $1 a $2.
dl() {
  local url; url="$(asset_url "$1")"
  test -n "$url" || { echo "ERROR: asset $1 no está en el release de goprey"; exit 1; }
  curl -fsSL -o "$2" "$url"
}

dl "checksums.txt" "$WORK/checksums.txt"

# Verifica $1 (ruta local) contra checksums.txt por su basename.
verify_sha() {
  local f="$1" name; name="$(basename "$f")"
  local want; want=$(grep -E " \./${name}\$| ${name}\$" "$WORK/checksums.txt" | awk '{print $1}' | head -1)
  test -n "$want" || { echo "ERROR: $name no está en checksums.txt"; exit 1; }
  echo "${want}  ${f}" | sha256sum --check --status || { echo "ERROR: sha256 no coincide para $name"; exit 1; }
}

rm -rf "$OUT"; mkdir -p "$OUT"/{windows/x86,windows/x64,mac/x64,mac/arm64,linux/x64}

# 2a) Windows: binarios sueltos.
for a in x86 x64; do
  f="prey-recovery-${VERSION}-${a}.exe"
  dl "$f" "$WORK/$f"; verify_sha "$WORK/$f"
  cp "$WORK/$f" "$OUT/windows/$a/remrecovery.exe"
done

# 2b) macOS: dentro del zip darwin (x64->amd64, arm64->arm64).
for pair in "x64:amd64" "arm64:arm64"; do
  na="${pair%%:*}"; ga="${pair##*:}"
  z="prey-darwin-${VERSION}-${ga}.zip"
  dl "$z" "$WORK/$z"; verify_sha "$WORK/$z"
  unzip -p "$WORK/$z" "PreyAgent.app/Contents/MacOS/remrecovery" > "$OUT/mac/$na/remrecovery"
  chmod 0755 "$OUT/mac/$na/remrecovery"
done

# 2c) Linux x64: dentro del zip linux + firma Ed25519 detachada.
z="prey-linux-${VERSION}-amd64.zip"
dl "$z" "$WORK/$z"; verify_sha "$WORK/$z"
unzip -p "$WORK/$z" "remrecovery" > "$OUT/linux/x64/remrecovery"
chmod 0755 "$OUT/linux/x64/remrecovery"
dl "prey-recovery-linux-${VERSION}-amd64.sig" "$OUT/linux/x64/remrecovery.sig"

echo "remrecovery staged:"; find "$OUT" -type f | sort
