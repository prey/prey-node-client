#!/usr/bin/env bash
set -uo pipefail
{ # braces: bash parses the whole script before running it (safe to edit mid-run)

DISTRO=tumbleweed
while [ $# -gt 0 ]; do
  case "$1" in
    --distro) DISTRO="${2:-}"; shift 2 ;;
    --distro=*) DISTRO="${1#*=}"; shift ;;
    -h | --help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) break ;;
  esac
done
SCRIPT="${1:-}"
die() { echo "ERROR: $*" >&2; exit 2; }
[ -f "$SCRIPT" ] || die "usage: $0 [--distro tumbleweed|fedora] <create_user.sh>"
SCRIPT="$(cd "$(dirname "$SCRIPT")" && pwd)/$(basename "$SCRIPT")"
LIB_DIR="$(cd "$(dirname "$SCRIPT")/../../.." && pwd)" # .../lib
[ "$(basename "$LIB_DIR")" = lib ] || die "expected the script under <root>/lib/conf/tasks/utils/ (got lib dir $LIB_DIR)"
REL="${SCRIPT#"$LIB_DIR"/}"                                 # conf/tasks/utils/create_user.sh

case "$DISTRO" in
  tumbleweed) BASE=opensuse/tumbleweed
    PREP='zypper -n --gpg-auto-import-keys in --no-recommends sudo shadow which util-linux && zypper -n clean -a && test ! -e /etc/sudoers' ;;
  fedora) BASE=fedora:43
    PREP='dnf -y --setopt=install_weak_deps=False install sudo shadow-utils which util-linux && dnf clean all' ;;
  *) die "unknown distro '$DISTRO'" ;;
esac
IMAGE="prey-test-cu-$DISTRO"
CNAME="prey-test-cu-$DISTRO-$$"
NPASS=0 NFAIL=0

result() {
  local s="$1"
  shift
  case "$s" in PASS) NPASS=$((NPASS + 1)) ;; FAIL) NFAIL=$((NFAIL + 1)) ;; esac
  printf '%-4s %s\n' "$s" "$*"
}
indent() { sed 's/^/        | /'; }
cx() { docker exec -e LC_ALL=C "$CNAME" bash -c "umask 022; $1"; }
cleanup() {
  local rc=$?
  if [ "${KEEP:-0}" = 1 ]; then echo "KEEP=1: docker exec -it $CNAME bash   (remove: docker rm -f $CNAME)"
  else docker rm -f "$CNAME" >/dev/null 2>&1; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

printf 'FROM %s\nRUN %s\n' "$BASE" "$PREP" | docker build -q --network host -t "$IMAGE" - >/dev/null \
  || die "image build failed"
docker run -d --name "$CNAME" --network none --hostname "cu-$DISTRO" "$IMAGE" sleep infinity >/dev/null || die "docker run failed"
docker cp -q "$LIB_DIR" "$CNAME:/opt/prey/lib" 2>/dev/null || { cx 'mkdir -p /opt/prey' && docker cp -q "$LIB_DIR" "$CNAME:/opt/prey/lib"; } || die "docker cp failed"
cx 'chown -R root:root /opt/prey; useradd -m -s /bin/bash preytester' >/dev/null 2>&1

sudoers_state() { cx '[ -e /etc/sudoers ] && sha256sum /etc/sudoers | cut -d" " -f1 || echo absent'; }
SUDOERS_BEFORE="$(sudoers_state)"
VISUDO_BASELINE="$(cx 'visudo -c 2>&1')"
echo "== $DISTRO: testing $SCRIPT"
echo "   /etc/sudoers before: $SUDOERS_BEFORE; /usr/etc/sudoers: $(cx '[ -e /usr/etc/sudoers ] && echo present || echo absent'); groups adm/video/audio: $(cx 'for g in adm video audio; do getent group $g >/dev/null && echo -n "$g=yes " || echo -n "$g=no "; done')"
echo "   baseline visudo -c: $(tr '\n' ' ' <<<"$VISUDO_BASELINE")"
echo "   (video/audio membership is not asserted: minimal images may lack those groups)"

SW_SHA=""
for run in 1 2; do
  echo
  echo "--- run $run: bash /opt/prey/lib/$REL prey"
  out="$(cx "cd / && bash /opt/prey/lib/$REL prey 2>&1")"
  rc=$?
  echo "$out" | indent
  if [ "$rc" -eq 0 ]; then result PASS "[run$run] exit status 0"; else result FAIL "[run$run] exit status $rc"; fi

  if pw="$(cx 'getent passwd prey')"; then result PASS "[run$run] user prey exists: $pw (groups: $(cx 'id -nG prey'))"
  else result FAIL "[run$run] user prey was NOT created"; fi

  st="$(sudoers_state)"
  if [ "$DISTRO" = tumbleweed ]; then
    if [ "$st" = absent ]; then result PASS "[run$run] /etc/sudoers does not exist"
    else result FAIL "[run$run] /etc/sudoers was CREATED (shadows /usr/etc/sudoers):"; cx 'ls -l /etc/sudoers; cat /etc/sudoers' | indent; fi
  else
    if [ "$st" = "$SUDOERS_BEFORE" ]; then result PASS "[run$run] /etc/sudoers unchanged"
    else result FAIL "[run$run] /etc/sudoers modified:"; cx 'diff <(echo) /etc/sudoers | tail -n 3' | indent; fi
  fi

  sw="$(cx "stat -c '%U:%G %a' /etc/sudoers.d/51_prey_switcher 2>/dev/null")"
  if [ "$sw" = "root:root 440" ]; then result PASS "[run$run] /etc/sudoers.d/51_prey_switcher exists ($sw): $(cx 'cat /etc/sudoers.d/51_prey_switcher')"
  else result FAIL "[run$run] /etc/sudoers.d/51_prey_switcher: '${sw:-missing}' (expected root:root 440)"; fi
  if [ "$run" = 1 ]; then SW_SHA="$(cx 'sha256sum /etc/sudoers.d/51_prey_switcher 2>/dev/null')"
  elif [ "$(cx 'sha256sum /etc/sudoers.d/51_prey_switcher 2>/dev/null')" = "$SW_SHA" ]; then result PASS "[run2] 51_prey_switcher unchanged by second run"
  else result FAIL "[run2] 51_prey_switcher changed by second run"; fi

  v="$(cx 'visudo -c 2>&1')"
  vrc=$?
  newerr="$(grep -v 'parsed OK' <<<"$v" | grep -vxF -f <(grep -v 'parsed OK' <<<"$VISUDO_BASELINE") || true)"
  if [ "$vrc" -eq 0 ]; then result PASS "[run$run] visudo -c OK"
  elif [ -z "$newerr" ] && grep -q '51_prey_switcher: parsed OK' <<<"$v"; then
    result PASS "[run$run] visudo -c: only the pre-existing distro error(s): $(grep -v 'parsed OK' <<<"$v" | tr '\n' ' ')"
  else result FAIL "[run$run] visudo -c (rc=$vrc):"; echo "$v" | indent; fi

  if o="$(cx 'sudo -n true 2>&1')"; then result PASS "[run$run] root: sudo -n true works"
  else result FAIL "[run$run] root can no longer use sudo: $o"; fi

  if o="$(cx 'sudo -l -U prey 2>&1')" && grep -q 'NOPASSWD' <<<"$o"; then result PASS "[run$run] sudo -l -U prey lists the NOPASSWD rule"
  else result FAIL "[run$run] sudo -l -U prey failed/no rule:"; echo "$o" | tail -n 4 | indent; fi

  if cx_out="$(cx 'getent passwd prey >/dev/null && cd / && runuser -u prey -- sudo -n su preytester -c whoami 2>&1')" && [ "$cx_out" = preytester ]; then
    result PASS "[run$run] prey can impersonate a user via 'sudo -n su preytester' (as runner.js does)"
  else result FAIL "[run$run] impersonation via 'sudo su preytester' failed: ${cx_out:-no prey user}"; fi
done

echo
echo "== $DISTRO: PASS=$NPASS FAIL=$NFAIL ($SCRIPT)"
[ "$NFAIL" -eq 0 ]
}
