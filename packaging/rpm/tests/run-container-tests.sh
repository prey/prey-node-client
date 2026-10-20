#!/usr/bin/env bash
set -uo pipefail
{ # braces: bash parses the whole script before running it (safe to edit mid-run)

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISTRO="${1:-}"
RPM="${2:-}"
RPM_UP="${3:-}"

usage() { sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2; }
die() { echo "ERROR: $*" >&2; exit 2; }

case "$DISTRO" in fedora | tumbleweed) ;; *) usage ;; esac
[ -f "$RPM" ] || die "rpm not found: $RPM"
[ -z "$RPM_UP" ] || [ -f "$RPM_UP" ] || die "upgrade rpm not found: $RPM_UP"

KEEP="${KEEP:-0}"
PRIVILEGED="${PRIVILEGED:-0}"
PROXY="${PROXY:-auto}"
REBUILD="${REBUILD:-0}"
SERVICE_WAIT="${SERVICE_WAIT:-60}"
SETTLE="${SETTLE:-20}"
EXPECTED_NODE="${EXPECTED_NODE:-v22.23.0}"
WEAK_DEPS="${WEAK_DEPS:-1}"
DNF_WEAK=""; ZYP_WEAK=""
[ "$WEAK_DEPS" = "0" ] && DNF_WEAK="--setopt=install_weak_deps=False" && ZYP_WEAK="--no-recommends"
IMAGE="prey-test-$DISTRO"
CNAME="${CNAME:-prey-test-$DISTRO-$$}"
RESULTS_DIR="${RESULTS_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/prey-rpm-test-$DISTRO.XXXXXX")}"
mkdir -p "$RESULTS_DIR" || die "cannot create $RESULTS_DIR"
: > "$RESULTS_DIR/summary.txt"

RPM_DIR="$(cd "$(dirname "$RPM")" && pwd)"
RPM_FILE="$(basename "$RPM")"
if [ -n "$RPM_UP" ]; then
  RPM_UP_DIR="$(cd "$(dirname "$RPM_UP")" && pwd)"
  RPM_UP_FILE="$(basename "$RPM_UP")"
fi

PROXY_PID=""
NPASS=0 NFAIL=0 NWARN=0
FAILED_IDS=()

log() { printf '\n=== %s\n' "$*"; }
result() {
  local status="$1" id="$2"
  shift 2
  case "$status" in
    PASS) NPASS=$((NPASS + 1)) ;;
    FAIL) NFAIL=$((NFAIL + 1)); FAILED_IDS+=("$id") ;;
    WARN) NWARN=$((NWARN + 1)) ;;
  esac
  printf '%-4s [%s] %s\n' "$status" "$id" "$*" | tee -a "$RESULTS_DIR/summary.txt"
}
pass() { result PASS "$@"; }
fail() { result FAIL "$@"; }
warn() { result WARN "$@"; }
info() { result INFO "$@"; }
check() {
  local id="$1" desc="$2"
  shift 2
  if "$@"; then pass "$id" "$desc"; else fail "$id" "$desc"; fi
}
indent() { sed 's/^/        | /'; }

cx() { docker exec -e LC_ALL=C "$CNAME" bash -o pipefail -c "umask 022; $1"; }
cx_ok() { cx "$1" >/dev/null 2>&1; }

cleanup() {
  local rc=$?
  if [ -n "$PROXY_PID" ]; then kill "$PROXY_PID" 2>/dev/null; wait "$PROXY_PID" 2>/dev/null; fi
  if docker inspect "$CNAME" >/dev/null 2>&1; then
    if [ "$KEEP" = "1" ]; then
      echo "KEEP=1: container left running: docker exec -it $CNAME bash   (remove: docker rm -f $CNAME)"
      [ -n "$PROXY_PID" ] && echo "       (note: the egress proxy was stopped, the container has no package-repo access now)"
    else
      docker rm -f "$CNAME" >/dev/null 2>&1
    fi
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

pm_install() {
  case "$DISTRO" in
    fedora) cx "dnf -y $DNF_WEAK ${DNF_EXTRA:-} install $1" ;;
    tumbleweed) cx "zypper -n --gpg-auto-import-keys in $ZYP_WEAK --allow-unsigned-rpm $1" ;;
  esac
}
pm_reinstall() {
  case "$DISTRO" in
    fedora) cx "dnf -y ${DNF_EXTRA:-} reinstall $1" ;;
    tumbleweed) cx "zypper -n --gpg-auto-import-keys in -f --allow-unsigned-rpm $1" ;;
  esac
}

scriptlet_problems() {
  grep -nE 'scriptlet failed|%(pre|post|preun|postun|pretrans|posttrans)\b.*(failed|exit status)|does not exist - using root|warning: (user|group) .* does not exist|^error:|[Ee]rror: |command not found|No such file or directory|Permission denied|Traceback|UNCAUGHT|ERR_[A-Z_]+' "$1" \
    | grep -vE 'Error: No API key|^[0-9]+:\s*$|trying next mirror|Preloading:|Retrieving:|Downloading|[Cc]url error|mirror' || true
}

sha() { cx "sha256sum $1 2>/dev/null | cut -d' ' -f1"; }

sudoers_state() { cx '[ -e /etc/sudoers ] && sha256sum /etc/sudoers | cut -d" " -f1 || echo absent'; }

visudo_check() {
  local id="$1" out rc new_errs
  out="$(cx 'visudo -c 2>&1')"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    pass "$id" "visudo -c OK"
    return
  fi
  new_errs="$(grep -vE 'parsed OK' <<<"$out" | grep -vxF -f <(grep -vE 'parsed OK' <<<"$VISUDO_BASELINE") || true)"
  if [ -z "$new_errs" ] && { grep -q '51_prey_switcher: parsed OK' <<<"$out" || ! cx_ok 'test -e /etc/sudoers.d/51_prey_switcher'; }; then
    pass "$id" "visudo -c: only pre-existing distro errors (rc=$rc, same as before install): $(grep -v 'parsed OK' <<<"$out" | tr '\n' ' ')"
  else
    fail "$id" "visudo -c failed (rc=$rc)"
    echo "$out" | indent
  fi
}

wait_for_agent() {
  local deadline=$((SECONDS + SERVICE_WAIT)) props mainpid
  SVC_STARTED=0 SVC_SEEN_USER="" SVC_STATE=""
  while [ $SECONDS -lt $deadline ]; do
    props="$(cx 'systemctl show prey-agent -p ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestampMonotonic,InvocationID')"
    SVC_STATE="$(tr '\n' ' ' <<<"$props")"
    mainpid="$(sed -n 's/^MainPID=//p' <<<"$props")"
    if [ "$(sed -n 's/^ExecMainStartTimestampMonotonic=//p' <<<"$props")" != "0" ] \
       || [ "$(sed -n 's/^NRestarts=//p' <<<"$props")" != "0" ]; then
      SVC_STARTED=1
    fi
    if [ -n "$mainpid" ] && [ "$mainpid" != "0" ]; then
      SVC_STARTED=1
      SVC_SEEN_USER="$(cx "ps -o user= -p $mainpid" | tr -d ' ')"
      [ -n "$SVC_SEEN_USER" ] && break
    fi
    sleep 2
  done
}

collect_logs() {
  local tag="$1"
  cx 'journalctl -u prey-agent --no-pager -o short-iso 2>&1' >"$RESULTS_DIR/journal-prey-agent.$tag.log"
  cx 'cat /var/log/prey.log 2>&1' >"$RESULTS_DIR/prey.log.$tag"
  cx 'systemctl status prey-agent --no-pager -l 2>&1' >"$RESULTS_DIR/systemctl-status.$tag.txt"
}

BAD_LOG_RE='UNCAUGHT|ERR_INVALID_ARG_TYPE|Cannot find module|EACCES'
EXPECTED_EXIT_RE='UNCAUGHT EXCEPTION: Not configured\. Stopping\.'

log "Building image $IMAGE ($DISTRO)"
build_args=(--network host -t "$IMAGE" -f "$HERE/Dockerfile.$DISTRO")
[ "$REBUILD" = "1" ] && build_args+=(--pull --no-cache)
docker build -q "${build_args[@]}" "$HERE" >"$RESULTS_DIR/image-build.log" 2>&1 \
  || { cat "$RESULTS_DIR/image-build.log"; die "image build failed"; }

log "Starting container $CNAME (results: $RESULTS_DIR)"
run_args=(-d -t --name "$CNAME" --hostname "prey-$DISTRO"
  --cgroupns=private --tmpfs /run --tmpfs /run/lock
  -v "$RPM_DIR:/rpms:ro,z")
[ -n "$RPM_UP" ] && run_args+=(-v "$RPM_UP_DIR:/rpms-up:ro,z")
if [ "$PRIVILEGED" = "1" ]; then
  run_args+=(--privileged)
else
  run_args+=(--cap-add SYS_ADMIN --security-opt label=disable --security-opt seccomp=unconfined)
fi
printf 'docker run %s %s\n' "${run_args[*]}" "$IMAGE" >"$RESULTS_DIR/docker-run.txt"
docker run "${run_args[@]}" "$IMAGE" >/dev/null || die "docker run failed"

state=""
for _ in $(seq 1 90); do
  if [ "$(docker inspect -f '{{.State.Running}}' "$CNAME" 2>/dev/null)" != "true" ]; then
    docker logs "$CNAME" 2>&1 | tail -n 30
    die "container exited during boot"
  fi
  state="$(docker exec "$CNAME" systemctl is-system-running 2>/dev/null)"
  case "$state" in running | degraded) break ;; esac
  sleep 1
done
case "$state" in
  running) pass boot "systemd is PID 1 and system is running" ;;
  degraded) pass boot "systemd booted (degraded; failed units: $(cx 'systemctl --failed --no-legend --plain | cut -d" " -f1' | tr '\n' ' '))" ;;
  *) docker logs "$CNAME" 2>&1 | tail -n 30; die "systemd did not reach running/degraded (state='$state')" ;;
esac

case "$DISTRO" in
  fedora) EGRESS_URL=https://mirrors.fedoraproject.org/ ;;
  tumbleweed) EGRESS_URL=https://download.opensuse.org/ ;;
esac
need_proxy=0
if [ "$PROXY" = "1" ]; then
  need_proxy=1
elif [ "$PROXY" = "auto" ] && ! cx_ok "curl -sS -m 10 -o /dev/null $EGRESS_URL"; then
  need_proxy=1
fi
if [ "$need_proxy" = "1" ]; then
  GW="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' "$CNAME")"
  [ -n "$GW" ] || die "cannot determine docker bridge gateway"
  python3 "$HERE/egress-proxy.py" "$GW" >"$RESULTS_DIR/proxy.out" 2>"$RESULTS_DIR/proxy.log" &
  PROXY_PID=$!
  for _ in $(seq 1 50); do grep -q LISTENING "$RESULTS_DIR/proxy.out" 2>/dev/null && break; sleep 0.1; done
  PROXY_URL="$(awk '/LISTENING/ {print "http://" $2 ":" $3}' "$RESULTS_DIR/proxy.out")"
  [ -n "$PROXY_URL" ] || die "egress proxy did not start: $(cat "$RESULTS_DIR/proxy.log")"
  case "$DISTRO" in
    fedora) cx "echo 'proxy=$PROXY_URL' >> /etc/dnf/dnf.conf" ;;
    tumbleweed)
      cx "touch /etc/sysconfig/proxy; sed -i -e '/^\(PROXY_ENABLED\|HTTP_PROXY\|HTTPS_PROXY\)=/d' /etc/sysconfig/proxy
          printf 'PROXY_ENABLED=\"yes\"\nHTTP_PROXY=\"%s\"\nHTTPS_PROXY=\"%s\"\n' '$PROXY_URL' '$PROXY_URL' >> /etc/sysconfig/proxy" ;;
  esac
  if cx_ok "curl -sS -m 15 -o /dev/null -x $PROXY_URL $EGRESS_URL"; then
    info net "bridge has no direct egress; package managers use host proxy $PROXY_URL (bound to the docker gateway only)"
  else
    die "no egress even through proxy $PROXY_URL"
  fi
else
  info net "container has direct egress"
fi

log "Baseline (before install)"
SUDOERS_BEFORE="$(sudoers_state)"
VISUDO_BASELINE="$(cx 'visudo -c 2>&1')"
info baseline "/etc/sudoers before install: $SUDOERS_BEFORE; /usr/etc/sudoers: $(cx '[ -e /usr/etc/sudoers ] && echo present || echo absent')"
info baseline "visudo -c before install: $(tr '\n' ' ' <<<"$VISUDO_BASELINE")"
cx_ok 'getent passwd prey' && warn baseline "user prey already exists before install"
cx 'useradd -m -s /bin/bash preytester' >/dev/null 2>&1 # regular user for the impersonation test

log "Installing $RPM_FILE"
INSTALL_LOG="$RESULTS_DIR/install.log"
DNF_EXTRA=""
pm_install "/rpms/$RPM_FILE" >"$INSTALL_LOG" 2>&1
rc=$?
if [ "$rc" -ne 0 ] && [ "$DISTRO" = fedora ] && grep -qiE 'signature|gpg|NOKEY|not signed|digest' "$INSTALL_LOG"; then
  warn install "dnf refused the package on signature grounds; retrying with --nogpgcheck (see $INSTALL_LOG)"
  grep -iE 'signature|gpg|NOKEY|not signed|digest' "$INSTALL_LOG" | head -n 5 | indent
  DNF_EXTRA="--nogpgcheck"
  pm_install "/rpms/$RPM_FILE" >"$INSTALL_LOG" 2>&1
  rc=$?
fi
if [ "$rc" -ne 0 ] || ! cx_ok 'rpm -q prey'; then
  fail install "package install failed (rc=$rc)"
  tail -n 60 "$INSTALL_LOG" | indent
  exit 1
fi
pass install "installed $(cx 'rpm -q prey') (rc=0${DNF_EXTRA:+, needed $DNF_EXTRA})"
probs="$(scriptlet_problems "$INSTALL_LOG")"
if [ -z "$probs" ]; then pass install-scriptlets "no scriptlet errors/warnings in install output"
else fail install-scriptlets "suspicious lines in install output"; echo "$probs" | head -n 30 | indent; fi
cx 'rpm -q --recommends prey' | sort -u | while read -r dep; do
  [ -z "$dep" ] && continue
  hit=""
  alts="$dep"
  case "$dep" in "("*) alts="$(sed -E 's/^\((.*)\)$/\1/; s/ (or|and|if|with|unless|else) /\n/g' <<<"$dep" | awk '{print $1}')" ;; esac
  for alt in $alts; do
    hit="$(cx "rpm -q --whatprovides '$alt' 2>/dev/null | head -n1; exit \${PIPESTATUS[0]}")" && [ -n "$hit" ] && break
    hit=""
  done
  echo "  Recommends $dep -> ${hit:-NOT installed}"
done | tee "$RESULTS_DIR/recommends.txt"

log "a. prey system user"
pw="$(cx 'getent passwd prey')"
if [ -n "$pw" ]; then pass a1 "user prey exists: $pw"; else fail a1 "user prey does not exist"; fi
uid="$(cut -d: -f3 <<<"$pw")"
shell="$(cut -d: -f7 <<<"$pw")"
groups="$(cx 'id -nG prey 2>/dev/null')"
for g in video audio; do
  if grep -qw "$g" <<<"$groups"; then pass a2 "prey is member of $g (groups: $groups)"; else fail a2 "prey not in group $g (groups: $groups)"; fi
done
case "$shell" in */nologin | */false) pass a3 "login shell is $shell" ;; *) fail a3 "login shell is '$shell' (expected nologin/false)" ;; esac
if [ -n "$uid" ] && [ "$uid" -lt 1000 ]; then pass a4 "system uid $uid < 1000"; else fail a4 "uid '$uid' is not a system uid"; fi
check a5 "group prey exists" cx_ok 'getent group prey'

log "b. /etc/prey and log ownership"
st() { cx "stat -c '%U:%G %a %F' $1 2>/dev/null"; }
s="$(st /etc/prey)"
case "$s" in "prey:prey "*" directory") pass b1 "/etc/prey: $s" ;; *) fail b1 "/etc/prey: '${s:-missing}' (expected prey:prey directory)" ;; esac
for f in /etc/prey/prey.conf /etc/prey/commands.db; do
  s="$(st "$f")"
  case "$s" in "prey:"*) pass b2 "$f: $s" ;; *) fail b2 "$f: '${s:-missing}' (expected owner prey)" ;; esac
  owner_pkg="$(cx "rpm -qf $f 2>&1")"
  info b2 "$f rpm owner: $owner_pkg"
done
s="$(st /var/log/prey.log)"
case "$s" in
  "prey:prey 640 "*) pass b3 "/var/log/prey.log: $s" ;;
  "prey:"*) warn b3 "/var/log/prey.log owned by prey but mode differs from 0640: $s" ;;
  *) fail b3 "/var/log/prey.log: '${s:-missing}' (expected prey:prey 0640)" ;;
esac

log "c. sudoers"
s="$(st /etc/sudoers.d/51_prey_switcher)"
case "$s" in "root:root 440 regular file") pass c1 "/etc/sudoers.d/51_prey_switcher: $s" ;; *) fail c1 "/etc/sudoers.d/51_prey_switcher: '${s:-missing}' (expected root:root 0440)" ;; esac
visudo_check c2
if out="$(cx 'visudo -c -f /etc/sudoers.d/51_prey_switcher 2>&1')"; then pass c3 "visudo -c -f 51_prey_switcher: $out"; else fail c3 "visudo -c -f 51_prey_switcher"; echo "$out" | indent; fi
out="$(cx 'sudo -l -U prey 2>&1')"
if grep -qE 'NOPASSWD:.*su ' <<<"$out"; then pass c4 "sudo -l -U prey lists the NOPASSWD su rule"; else fail c4 "sudo -l -U prey has no NOPASSWD su rule"; fi
echo "$out" | indent
out="$(cx 'cd / && runuser -u prey -- sudo -n su preytester -c whoami 2>&1')"
if [ "$out" = "preytester" ]; then pass c5 "prey can impersonate a regular user: sudo -n su preytester -c whoami -> $out"; else fail c5 "impersonation failed: '$out'"; fi
if cx_ok 'cd / && runuser -u prey -- sudo -n su root -c true'; then fail c6 "prey can 'sudo su root' (must be denied)"; else pass c6 "prey cannot 'sudo su root'"; fi
if cx_ok 'cd / && runuser -u prey -- sudo -n su - preytester -c true'; then fail c6 "prey can 'sudo su - user' (must be denied)"; else pass c6 "prey cannot 'sudo su - <user>'"; fi
SUDOERS_AFTER="$(sudoers_state)"
if [ "$DISTRO" = tumbleweed ]; then
  if [ "$SUDOERS_AFTER" = absent ]; then pass c7 "/etc/sudoers does not exist (was: $SUDOERS_BEFORE)"; else fail c7 "/etc/sudoers was CREATED by the install (before: $SUDOERS_BEFORE)"; cx 'ls -l /etc/sudoers; cat /etc/sudoers' | indent; fi
else
  if [ "$SUDOERS_AFTER" = "$SUDOERS_BEFORE" ]; then pass c7 "/etc/sudoers unchanged ($SUDOERS_AFTER)"; else fail c7 "/etc/sudoers changed: $SUDOERS_BEFORE -> $SUDOERS_AFTER"; fi
fi
check c8 "root can still use sudo (sudo -n true)" cx_ok 'sudo -n true'

log "d. /opt/prey layout"
v="$(cx '/opt/prey/bin/node --version 2>&1')"
if [ "$v" = "$EXPECTED_NODE" ]; then pass d1 "/opt/prey/bin/node --version = $v"; else fail d1 "/opt/prey/bin/node --version = '$v' (expected $EXPECTED_NODE)"; fi
if cx_ok '[ -f /usr/bin/prey ] && [ ! -L /usr/bin/prey ]'; then pass d2 "/usr/bin/prey is a regular file"; else fail d2 "/usr/bin/prey is missing or a symlink: $(cx 'ls -l /usr/bin/prey 2>&1')"; fi
left="$(cx 'ls -d /opt/prey/current /opt/prey/versions 2>/dev/null')"
if [ -z "$left" ]; then pass d3 "no /opt/prey/current or /opt/prey/versions"; else fail d3 "unexpected: $left"; fi
foreign="$(cx "find /opt/prey -type f -exec file {} + 2>/dev/null | grep -E 'Mach-O|PE32'")"
if [ -z "$foreign" ]; then pass d4 "no Mach-O/PE32 binaries under /opt/prey"; else fail d4 "$(wc -l <<<"$foreign") foreign binaries under /opt/prey"; head -n 20 <<<"$foreign" | indent; fi
s="$(cx 'stat -c %U:%G /opt/prey')"
nonroot="$(cx 'find /opt/prey \( ! -user root -o ! -group root \) -printf "%u:%g %p\n" | head -n 20')"
if [ "$s" = "root:root" ] && [ -z "$nonroot" ]; then pass d5 "/opt/prey and everything below is root:root"; else fail d5 "/opt/prey owner $s; non-root entries:"; echo "$nonroot" | indent; fi
ww="$(cx 'find /opt/prey ! -type l -perm -0002 -printf "%m %p\n" | head -n 20')"
if [ -z "$ww" ]; then pass d6 "nothing world-writable under /opt/prey"; else fail d6 "world-writable entries under /opt/prey (root runs /opt/prey/bin/prey in scriptlets):"; echo "$ww" | indent; fi

log "e. shared library resolution"
for f in /opt/prey/lib/agent/actions/lock/linux/prey-lock-gtk4 /opt/prey/lib/conf/panel/linux/prey-config-gtk4; do
  if ! cx_ok "test -f $f"; then fail e1 "$f missing"; continue; fi
  nf="$(cx "ldd $f 2>&1" | grep 'not found' | awk '{print $1}' | sort -u | tr '\n' ' ')"
  if [ -z "$nf" ]; then pass e1 "ldd $(basename "$f"): all libraries resolved"
  else warn e1 "ldd $(basename "$f"): missing $nf(weak deps not pulled? see recommends.txt)"; fi
done
for f in /opt/prey/node_modules/sqlite3/build/Release/node_sqlite3.node /opt/prey/bin/node; do
  if ! cx_ok "test -f $f"; then fail e2 "$f missing"; continue; fi
  nf="$(cx "ldd $f 2>&1" | grep -E 'not found|not a dynamic' | tr '\n' ' ')"
  if [ -z "$nf" ]; then pass e2 "ldd $(basename "$f"): OK"; else fail e2 "ldd $(basename "$f"): $nf"; fi
done
out="$(cx "cd / && runuser -u prey -- /opt/prey/bin/node -e \"require('/opt/prey/node_modules/sqlite3'); console.log('sqlite3-loaded')\" 2>&1")"
if grep -q sqlite3-loaded <<<"$out"; then pass e3 "node can load the sqlite3 native addon (as prey)"
else fail e3 "node failed to load sqlite3 addon"; echo "$out" | tail -n 10 | indent; fi

log "f. prey-agent service"
en="$(cx 'systemctl is-enabled prey-agent 2>&1')"
if [ "$en" = enabled ]; then pass f1 "prey-agent is enabled"; else fail f1 "systemctl is-enabled prey-agent = '$en'"; fi
wait_for_agent
if [ "$SVC_STARTED" = 1 ]; then pass f2 "prey-agent has been started ($SVC_STATE)"; else fail f2 "prey-agent never started within ${SERVICE_WAIT}s ($SVC_STATE)"; fi
u="$(cx 'systemctl show -p User --value prey-agent')"
if [ "$u" = prey ]; then pass f3 "unit User=prey"; else fail f3 "unit User='$u'"; fi
if [ "$SVC_SEEN_USER" = prey ]; then pass f4 "main process observed running as user prey"
else fail f4 "main process never observed running as prey (seen user: '${SVC_SEEN_USER:-none}')"; fi
cx 'ps -o user,pid,etime,args -u prey 2>/dev/null' | indent
sleep "$SETTLE"
collect_logs install
bad="$(cat "$RESULTS_DIR/journal-prey-agent.install.log" "$RESULTS_DIR/prey.log.install" | grep -E "$BAD_LOG_RE" | grep -vE "$EXPECTED_EXIT_RE" | head -n 20)"
if [ -z "$bad" ]; then pass f5 "no $BAD_LOG_RE in journal / prey.log (besides the unlinked-device exit)"; else fail f5 "crash signatures in agent logs:"; echo "$bad" | indent; fi
info f6 "'Not configured' occurrences: $(grep -c 'Not configured' "$RESULTS_DIR/prey.log.install" "$RESULTS_DIR/journal-prey-agent.install.log" | tr '\n' ' '); unlinked-device exits: $(grep -chE "$EXPECTED_EXIT_RE" "$RESULTS_DIR/prey.log.install"); restarts: $(cx 'systemctl show -p NRestarts --value prey-agent')"
echo "  last prey.log lines:"; tail -n 8 "$RESULTS_DIR/prey.log.install" | indent

log "g. CLI as user prey"
CRASH_RE='UNCAUGHT|TypeError|ReferenceError|SyntaxError|ERR_[A-Z_]{4,}|Cannot find module|EACCES|Segmentation fault|core dumped|failed to execute|Permission denied|No such file or directory|command not found'
if ! cx_ok 'systemctl is-active --quiet prey-agent'; then
  warn g1 "skipped prey -N: prey-agent not active right now (restart window), it would start a stray agent"
else
  out="$(cx 'cd / && timeout 20 runuser -u prey -- /opt/prey/bin/prey -N 2>&1')"; rc=$?
  if [ "$out" = "$EXPECTED_NODE" ]; then pass g1 "prey -N -> $out"
  elif [ "$rc" -eq 124 ]; then warn g1 "prey -N did not return within 20 s (started an agent; killed by timeout)"
  elif grep -qE "$CRASH_RE" <<<"$out"; then fail g1 "prey -N crashed: $out"
  else warn g1 "prey -N did not print the node version (upstream: lib/agent/cli.js reads program.nodeVersion, but commander 9 keeps options in program.opts()); output: $(head -n 2 <<<"$out" | tr '\n' ' ')"; fi
fi
pkgver="$(cx "rpm -q --qf '%{VERSION}' prey")"
out="$(cx 'cd / && runuser -u prey -- /usr/bin/prey --version 2>&1')"
if grep -qF "$pkgver" <<<"$out"; then pass g2 "/usr/bin/prey --version -> $out"; else fail g2 "/usr/bin/prey --version -> '$out' (expected $pkgver)"; fi
out="$(cx 'cd / && timeout 90 runuser -u prey -- /usr/bin/prey config check 2>&1; echo "rc=$?"')"
rc="$(tail -n1 <<<"$out" | sed 's/rc=//')"
if [ "$rc" -lt 124 ] && ! grep -qE "$CRASH_RE" <<<"$out" && grep -qi 'check' <<<"$out"; then pass g3 "prey config check ran without crashing (rc=$rc)"
else fail g3 "prey config check crashed/timed out (rc=$rc)"; fi
echo "$out" | tail -n 8 | indent

log "j. accidental 'prey config hooks post_install' as root"
J_SUDOERS="$(sudoers_state)"
J_LOG_LINES="$(cx 'wc -l < /var/log/prey.log')"
out="$(cx 'timeout 180 /opt/prey/bin/prey config hooks post_install 2>&1; echo "rc=$?"')"
rc="$(tail -n1 <<<"$out" | sed 's/rc=//')"
if [ "$rc" = 0 ]; then pass j1 "post_install exited 0"; else warn j1 "post_install rc=$rc"; echo "$out" | tail -n 8 | indent; fi
st="$(cx 'systemctl is-enabled prey-agent 2>&1')"
if [ "$st" = enabled ]; then pass j2 "prey-agent still enabled"; else fail j2 "prey-agent is '$st' after post_install"; fi
st="$(cx 'systemctl show -p ActiveState --value prey-agent')"
case "$st" in
  active|activating) pass j3 "prey-agent still $st" ;;
  *) fail j3 "prey-agent is '$st' after post_install" ;;
esac
if cx_ok 'test -e /etc/systemd/system/prey-agent.service'; then fail j4 "post_install created /etc/systemd/system/prey-agent.service"
else pass j4 "no competing unit in /etc/systemd/system"; fi
n="$(cx 'find /opt/prey ! -user root | wc -l')"
if [ "$n" = 0 ]; then pass j5 "/opt/prey still entirely root-owned"; else fail j5 "$n paths under /opt/prey not owned by root"; fi
st="$(sudoers_state)"
if [ "$st" = "$J_SUDOERS" ]; then pass j6 "/etc/sudoers unchanged ($st)"; else fail j6 "/etc/sudoers changed: $J_SUDOERS -> $st"; fi
n="$(cx 'wc -l < /var/log/prey.log')"
if [ "$n" -ge "$J_LOG_LINES" ]; then pass j7 "/var/log/prey.log not truncated ($J_LOG_LINES -> $n lines)"
else fail j7 "/var/log/prey.log truncated ($J_LOG_LINES -> $n lines)"; fi

if [ -n "$RPM_UP" ]; then
  log "h. upgrade to $RPM_UP_FILE"
  MARK="prey-rpm-test-$$-$RANDOM"
  cx "echo '# $MARK' >> /etc/prey/prey.conf"
  DB_MARK_JS="const s=require('/opt/prey/node_modules/sqlite3');const d=new s.Database('/etc/prey/commands.db');d.configure('busyTimeout',15000);d.serialize(()=>{d.run('CREATE TABLE IF NOT EXISTS prey_rpm_test (v TEXT)');if(process.argv[1]==='w')d.run('INSERT INTO prey_rpm_test VALUES (?)',['$MARK']);d.get('SELECT v FROM prey_rpm_test WHERE v=?',['$MARK'],(e,r)=>{console.log(e?'ERR '+e.message:(r?r.v:'MISSING'));d.close();});});"
  dbm="$(cx "cd / && runuser -u prey -- /opt/prey/bin/node -e \"$DB_MARK_JS\" w 2>&1" | tail -n1)"
  DB_MARKER=0
  [ "$dbm" = "$MARK" ] && DB_MARKER=1
  info h0 "data markers: prey.conf comment; commands.db row: $([ $DB_MARKER = 1 ] && echo yes || echo "unavailable ($dbm)")"
  cx 'cat /etc/prey/prey.conf' >"$RESULTS_DIR/prey.conf.before-upgrade"
  CONF_SHA="$(sha /etc/prey/prey.conf)"
  DB_SHA="$(sha /etc/prey/commands.db)"
  SUDO_SHA="$(sha /etc/sudoers.d/51_prey_switcher)"
  INV_BEFORE="$(cx 'systemctl show -p InvocationID --value prey-agent')"
  TS="$(cx 'date +%s')"
  NEVRA_UP="$(cx "rpm -qp --qf '%{NEVRA}' /rpms-up/$RPM_UP_FILE 2>/dev/null")"
  NEVRA_CUR="$(cx "rpm -q --qf '%{NEVRA}' prey")"
  UPGRADE_LOG="$RESULTS_DIR/upgrade.log"
  if [ "$NEVRA_UP" = "$NEVRA_CUR" ]; then
    info h0 "upgrade RPM has the same NEVRA as the installed one ($NEVRA_CUR) -> testing a reinstall"
    pm_reinstall "/rpms-up/$RPM_UP_FILE" >"$UPGRADE_LOG" 2>&1
  else
    pm_install "/rpms-up/$RPM_UP_FILE" >"$UPGRADE_LOG" 2>&1
  fi
  rc=$?
  now="$(cx "rpm -q --qf '%{NEVRA}' prey")"
  if [ "$rc" -eq 0 ] && [ "$now" = "$NEVRA_UP" ]; then pass h1 "upgraded $NEVRA_CUR -> $now"
  else fail h1 "upgrade failed (rc=$rc, installed: $now)"; tail -n 40 "$UPGRADE_LOG" | indent; fi
  probs="$(scriptlet_problems "$UPGRADE_LOG")"
  if [ -z "$probs" ]; then pass h2 "no scriptlet errors/warnings in upgrade output"
  else fail h2 "suspicious lines in upgrade output"; echo "$probs" | head -n 30 | indent; fi

  cx 'cat /etc/prey/prey.conf' >"$RESULTS_DIR/prey.conf.after-upgrade"
  s="$(sha /etc/prey/prey.conf)"
  if [ "$s" = "$CONF_SHA" ]; then pass h3 "prey.conf unchanged (sha256 ${s:0:12}…)"
  elif cx_ok "grep -qF '# $MARK' /etc/prey/prey.conf"; then warn h3 "prey.conf content changed during upgrade but the user edit survived:"
    diff "$RESULTS_DIR/prey.conf.before-upgrade" "$RESULTS_DIR/prey.conf.after-upgrade" | head -n 20 | indent
  else fail h3 "prey.conf replaced/reset during upgrade, user edit lost (scriptlet, or the restarted agent rewriting it):"
    diff "$RESULTS_DIR/prey.conf.before-upgrade" "$RESULTS_DIR/prey.conf.after-upgrade" | head -n 20 | indent; fi
  s="$(sha /etc/prey/commands.db)"
  if [ "$s" = "$DB_SHA" ]; then pass h4 "commands.db unchanged (sha256 ${s:0:12}…)"
  elif [ "$DB_MARKER" = 1 ]; then
    dbm="$(cx "cd / && runuser -u prey -- /opt/prey/bin/node -e \"$DB_MARK_JS\" r 2>&1" | tail -n1)"
    if [ "$dbm" = "$MARK" ]; then pass h4 "commands.db bytes changed (agent writes) but the test row survived the upgrade"
    else fail h4 "commands.db data lost on upgrade (marker query: $dbm)"; fi
  else warn h4 "commands.db sha256 changed and no data marker available to tell agent writes from replacement"; fi
  rpmnew="$(cx 'ls -d /etc/sudoers.rpm* /etc/sudoers.d/*.rpm* /etc/prey/*.rpm* 2>/dev/null')"
  if [ -z "$rpmnew" ]; then pass h5 "no .rpmnew/.rpmsave files for sudoers or /etc/prey"; else fail h5 "leftover: $rpmnew"; fi
  s="$(sha /etc/sudoers.d/51_prey_switcher)"
  [ "$s" = "$SUDO_SHA" ] || info h5 "51_prey_switcher content changed by upgrade: ${SUDO_SHA:0:12} -> ${s:0:12}"
  en="$(cx 'systemctl is-enabled prey-agent 2>&1')"
  if [ "$en" = enabled ]; then pass h6 "prey-agent still enabled"; else fail h6 "prey-agent is-enabled = '$en' after upgrade"; fi
  wait_for_agent
  INV_AFTER="$(cx 'systemctl show -p InvocationID --value prey-agent')"
  stopping="$(cx "journalctl -u prey-agent --since @$TS --no-pager -o cat | grep -cE '^Stopping|Stopping prey-agent'")"
  if [ "$INV_AFTER" != "$INV_BEFORE" ] && [ "$SVC_SEEN_USER" = prey ]; then
    pass h7 "prey-agent restarted (new InvocationID; explicit 'Stopping' entries since upgrade: $stopping) and running as prey"
  else fail h7 "prey-agent not restarted/running after upgrade (InvocationID $INV_BEFORE -> $INV_AFTER, user '${SVC_SEEN_USER}', $SVC_STATE)"; fi
  ver="$(cx 'rpm -V prey 2>&1')"
  badv="$(grep -vE '^\S+\s+c\s|/var/log/prey\.log$' <<<"$ver" | grep -v '^$' || true)"
  if [ -z "$badv" ]; then pass h8 "rpm -V prey clean (allowed: $(grep -cE '\S' <<<"$ver") config/ghost deviations)"
  else fail h8 "rpm -V prey reports unexpected deviations"; echo "$badv" | head -n 20 | indent; fi
  SUDOERS_AFTER="$(sudoers_state)"
  if [ "$SUDOERS_AFTER" = "$SUDOERS_BEFORE" ]; then pass h9 "/etc/sudoers unchanged after upgrade ($SUDOERS_AFTER)"; else fail h9 "/etc/sudoers changed by upgrade: $SUDOERS_BEFORE -> $SUDOERS_AFTER"; fi
  sleep "$SETTLE"
  collect_logs upgrade
  bad="$(cx "journalctl -u prey-agent --since @$TS --no-pager -o cat" | grep -E "$BAD_LOG_RE" | grep -vE "$EXPECTED_EXIT_RE" | head -n 20)"
  if [ -z "$bad" ]; then pass h10 "no $BAD_LOG_RE in agent journal after upgrade (besides the unlinked-device exit)"; else fail h10 "crash signatures after upgrade:"; echo "$bad" | indent; fi
fi

log "i. erase"
ERASE_LOG="$RESULTS_DIR/erase.log"
cx 'rpm -e prey' >"$ERASE_LOG" 2>&1
rc=$?
if [ "$rc" -eq 0 ] && ! cx_ok 'rpm -q prey'; then pass i1 "rpm -e prey succeeded"; else fail i1 "rpm -e prey failed (rc=$rc)"; fi
probs="$(scriptlet_problems "$ERASE_LOG")"
if [ -z "$probs" ]; then pass i1 "no scriptlet errors in erase output"; else fail i1 "suspicious lines in erase output"; echo "$probs" | head -n 20 | indent; fi
[ -s "$ERASE_LOG" ] && { echo "  erase output:"; head -n 15 "$ERASE_LOG" | indent; }
for p in /etc/sudoers.d/51_prey_switcher /usr/lib/systemd/system/prey-agent.service /etc/xdg/autostart/prey-xhost.desktop \
  /usr/bin/prey /usr/libexec/prey/prey-xhost /opt/prey; do
  if cx_ok "test -e $p -o -L $p"; then
    fail i2 "$p still exists after erase"
    cx "find $p -maxdepth 3 2>/dev/null | head -n 15" | indent
  else pass i2 "$p removed"; fi
done
for p in /etc/prey /etc/prey/prey.conf /etc/prey/commands.db; do
  if cx_ok "test -e $p"; then pass i3 "$p kept"; else fail i3 "$p was removed (user data/config must survive erase)"; fi
done
cx_ok 'test -d /usr/libexec/prey' && warn i2 "empty dir /usr/libexec/prey left behind (not owned by the package?)"
check i3 "user prey kept" cx_ok 'getent passwd prey'
rs="$(cx 'ls /etc/prey/*.rpmsave 2>/dev/null')"
[ -n "$rs" ] && info i3 "rpmsave files: $rs"
ls_="$(cx 'systemctl show -p LoadState --value prey-agent')"
if [ "$ls_" = not-found ]; then pass i4 "prey-agent unit not loaded (LoadState=$ls_)"; else fail i4 "prey-agent LoadState=$ls_ after erase"; fi
procs="$(cx 'pgrep -a -u prey')"
if [ -z "$procs" ]; then pass i4 "no processes running as prey"; else fail i4 "processes still running as prey:"; echo "$procs" | indent; fi
SUDOERS_AFTER="$(sudoers_state)"
if [ "$SUDOERS_AFTER" = "$SUDOERS_BEFORE" ]; then pass i5 "/etc/sudoers after erase: $SUDOERS_AFTER (same as before install)"
else fail i5 "/etc/sudoers changed: $SUDOERS_BEFORE -> $SUDOERS_AFTER"; fi
check i6 "root can still use sudo after erase (sudo -n true)" cx_ok 'sudo -n true'
visudo_check i6

log "Summary ($DISTRO, $RPM_FILE${RPM_UP:+ -> $RPM_UP_FILE})"
echo "PASS=$NPASS FAIL=$NFAIL WARN=$NWARN   results: $RESULTS_DIR"
if [ "$NFAIL" -gt 0 ]; then
  echo "Failed checks: ${FAILED_IDS[*]}"
  echo "--- journalctl -u prey-agent (last 60 lines)"
  cx 'journalctl -u prey-agent --no-pager -n 60' | indent
  echo "--- /var/log/prey.log (last 40 lines)"
  cx 'tail -n 40 /var/log/prey.log 2>&1' | indent
  echo "--- scriptlet output: see $INSTALL_LOG${RPM_UP:+, $RESULTS_DIR/upgrade.log}, $ERASE_LOG"
  exit 1
fi
exit 0
}
