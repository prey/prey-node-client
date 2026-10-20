#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="${1:?usage: $0 <outdir>}"
mkdir -p "$out"
out="$(cd "$out" && pwd)"

docker run --rm --network host \
  -v "$here:/src:ro,z" -v "$out:/out:z" fedora:43 bash -euc '
    dnf -y -q --setopt=install_weak_deps=False install rpm-build patchelf >/dev/null 2>&1
    for r in 1 2; do
      rpmbuild -bb --define "_topdir /tmp/rb" --define "dummy_release $r" /src/prey-dummy.spec >/tmp/rb.log 2>&1 \
        || { cat /tmp/rb.log; exit 1; }
    done
    cp /tmp/rb/RPMS/x86_64/prey-*.rpm /out/
    chown '"$(id -u):$(id -g)"' /out/prey-*.rpm
    ls -l /out
  '
