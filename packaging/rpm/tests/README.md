# prey RPM container tests

Docker-based checks for the prey RPM on Fedora 43 and openSUSE Tumbleweed, with
systemd running as PID 1. They need nothing on the host except docker and python3,
and no root.

| File | Purpose |
|---|---|
| `run-container-tests.sh` | Install → (upgrade) → erase test of the RPM with PASS/FAIL per check |
| `test-create-user.sh` | Runs `lib/conf/tasks/utils/create_user.sh` as root in a fresh container |
| `Dockerfile.fedora`, `Dockerfile.tumbleweed` | Minimal systemd images (`prey-test-<distro>`) |
| `egress-proxy.py` | Tiny HTTP/CONNECT proxy, used only when the docker bridge has no egress |
| `fixtures/` | Throwaway **dummy** prey RPM (`build-dummy-rpm.sh <outdir>`) used to test the harness itself |

## run-container-tests.sh

```sh
packaging/rpm/tests/run-container-tests.sh fedora     dist/rpm/prey-1.13.41-1.*.x86_64.rpm
packaging/rpm/tests/run-container-tests.sh tumbleweed dist/rpm/prey-1.13.41-1.*.x86_64.rpm [new.rpm]
```

The second RPM is optional. It is installed over the first to test an upgrade. If it is
the same NEVRA as the first, the script runs a reinstall instead, which still
exercises the `$1 == 2` scriptlet paths. Exit status: 0 means everything PASSed (WARNs
are allowed), 1 means at least one FAIL, 2 means a harness or environment error. The
logs go to `$RESULTS_DIR`, which defaults to a temp dir: install/upgrade/erase output
with scriptlet output, the agent journal, prey.log, and `summary.txt`.

Environment knobs:

| Knob | Effect |
|---|---|
| `KEEP=1` | Leave the container running at the end |
| `PRIVILEGED=1` | Use `--privileged` |
| `PROXY=auto\|1\|0` | Control the egress proxy |
| `WEAK_DEPS=0` | Don't install Recommends |
| `REBUILD=1` | Rebuild the image with `--pull --no-cache` |
| `SERVICE_WAIT=60` | Seconds to wait for prey-agent to come up |
| `SETTLE=20` | Extra seconds of agent runtime before its logs are grepped (use ≥130 to cover one "Not configured" exit/restart cycle) |
| `EXPECTED_NODE=v22.23.0` | Expected node version |

Package install commands, exactly as a user would run them:
- Fedora: `dnf -y install /rpms/<file>`. Weak deps are on. If dnf refuses an unsigned
  package, the script retries with `--nogpgcheck` and reports a WARN. On Fedora 43
  this isn't needed: rpm 6.0.2 there has `%_pkgverify_level digest`.
- Tumbleweed: `zypper -n --gpg-auto-import-keys in --allow-unsigned-rpm /rpms/<file>`.
  The TW container image disables Recommends; the Dockerfile restores the
  desktop default.

### Checks

| id | What it means |
|---|---|
| boot | systemd is PID 1 and `is-system-running` reports running/degraded |
| install, install-scriptlets | The package installs, and the dnf/zypper output has no scriptlet errors, "user does not exist - using root" warnings, etc. `recommends.txt` lists which weak deps were pulled |
| a1–a5 | `prey` system user and group exist; member of video and audio; shell nologin/false; uid < 1000 |
| b1–b3 | `/etc/prey` is prey:prey; `prey.conf` and `commands.db` are owned by prey (INFO says whether rpm owns them); `/var/log/prey.log` is prey:prey 0640 |
| c1–c3 | `/etc/sudoers.d/51_prey_switcher` is root:root 0440. `visudo -c` is OK, or has only errors that were already there before install: pristine TW ships `/usr/etc/sudoers` with mode 0444, which `visudo` flags. `visudo -c -f` on the drop-in passes |
| c4–c6 | `sudo -l -U prey` shows the NOPASSWD su rule. `sudo -n su preytester -c whoami` run as prey works, the same call `lib/system/utils/runner.js` makes. `su root` and `su - user` are denied |
| c7, c8 | **Regression guard**: on TW `/etc/sudoers` must not exist after install; on Fedora its sha256 must be unchanged. `sudo -n true` as root still works |
| d1–d6 | `/opt/prey/bin/node --version` matches. `/usr/bin/prey` is a regular file. No `/opt/prey/current` or `versions`. No Mach-O/PE32 files. Everything under `/opt/prey` is root:root and nothing is world-writable (root runs `/opt/prey/bin/prey` from `%preun`) |
| e1 | `ldd` of the gtk4 lock/config helpers. A missing lib is only a WARN (weak deps) |
| e2, e3 | `ldd` of `node_sqlite3.node` and `node` is clean, and node really `require()`s sqlite3 as prey |
| f1–f6 | Unit is enabled, has been started, `User=prey`, and the main process was seen running as prey. Journal and prey.log contain no `UNCAUGHT`, `ERR_INVALID_ARG_TYPE`, `Cannot find module` or `EACCES`, except upstream's designed `UNCAUGHT EXCEPTION: Not configured. Stopping.` exit of an unlinked agent (counted in f6) |
| g1–g3 | As prey: `prey -N`, `/usr/bin/prey --version`, and `prey config check` all run without a crash, exec failure or timeout. g1 is only a WARN when `-N` doesn't print the version: that's broken upstream, because cli.js reads `program.nodeVersion` but commander 9 keeps options in `opts()`. Since `-N` is ignored, g1 only runs while the service agent is active and is bounded by `timeout 20`, so it cannot leave a stray agent |
| j1–j7 | **Regression guard**: an accidental `prey config hooks post_install` as root keeps prey-agent enabled and active, creates no `/etc/systemd/system/prey-agent.service`, leaves `/opt/prey` root-owned and `/etc/sudoers` unchanged, and does not truncate `/var/log/prey.log` |
| h0–h10 | Upgrade (see below) |
| i1–i6 | Erase (see below) |

What the upgrade checks (h0–h10) do:
- Before the upgrade, they add user-data markers: a comment line in `prey.conf` and a row in `commands.db` (written via node+sqlite3).
- After it, both files must keep their sha256, or at least still contain the markers. The agent itself writes to them, so changed bytes alone aren't a failure.
- There must be no `.rpmnew`/`.rpmsave` files.
- The unit must still be enabled and must have restarted (new InvocationID, running as prey).
- `rpm -V` may show only config and %ghost deviations.
- `/etc/sudoers` must be unchanged, and the journal must have no crash signatures.

What the erase checks (i1–i6) do:
- `rpm -e prey` must run with clean scriptlets.
- The sudoers drop-in, the unit, the autostart entry, `/usr/bin/prey`, `prey-xhost` and `/opt/prey` must all be gone.
- `/etc/prey/{prey.conf,commands.db}` and the prey user must be kept.
- The unit must not be loaded, and no processes may still run as prey.
- `/etc/sudoers` must be the same as before install, and root's sudo and `visudo -c` must still work.

### Docker / host notes

The default flags (no `--privileged`) are:

```
docker run -d -t --cgroupns=private --tmpfs /run --tmpfs /run/lock \
  --cap-add SYS_ADMIN --security-opt label=disable --security-opt seccomp=unconfined \
  -v <rpmdir>:/rpms:ro,z prey-test-<distro>
```

The image entrypoint (`/usr/local/sbin/container-init`) remounts the cgroup2 fs read-write and then execs systemd. Docker mounts it read-only for non-privileged containers. `label=disable` avoids needing the `container_manage_cgroup` SELinux boolean. In this mode `/proc/sys` stays read-only and the host's `/dev` is not exposed. `PRIVILEGED=1` (`--privileged --cgroupns=private`) also works.

Both images mask units that could touch host-global state or the container's network (sysctl, binfmt, modules-load, time sync, NetworkManager, ModemManager, wpa_supplicant).

If the docker bridge has no egress, the script starts `egress-proxy.py` bound to the bridge gateway (e.g. `172.17.0.1`, not reachable from the LAN) and points dnf/zypper at it. A bridge can lack egress when, for example, the host has `net.ipv4.ip_forward=0`. Image builds use `--network host`, because build steps don't run systemd. The agent itself gets no proxy, so it may log connection errors. That's fine.

## test-create-user.sh

```sh
packaging/rpm/tests/test-create-user.sh [--distro tumbleweed|fedora] lib/conf/tasks/utils/create_user.sh
```

The script:
1. Copies the script's own `lib/` tree to `/opt/prey/lib` in a fresh container, so the script's "4 dirs up" path logic works. The container runs with `--network none`, has sudo, shadow and which installed, and runs no systemd.
2. Runs `create_user.sh prey` as root twice; the second run checks idempotency.
3. Asserts after each run:
   - Exit status is 0.
   - `id prey` exists.
   - `/etc/sudoers` was not created (TW) or not modified (Fedora).
   - `51_prey_switcher` is 0440 root, and the second run doesn't change it.
   - `visudo -c` passes, allowing for the same TW baseline exception as above.
   - Root `sudo -n true` still works.
   - `sudo -l -U prey` lists the rule.
   - prey can `sudo -n su preytester`.
