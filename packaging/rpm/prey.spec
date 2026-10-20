%global node_ver 22.23.0

%global debug_package %{nil}
%global __os_install_post %{nil}
%global _build_id_links none
%global _use_weak_usergroup_deps 1
%global __requires_exclude_from ^/opt/prey/(node_modules|lib)/.*$
%global __provides_exclude_from ^/opt/prey/.*$

Name:           prey
Version:        %{?pkg_version}%{!?pkg_version:1.13.41}
Release:        %{?pkg_release}%{!?pkg_release:1}.git%{?gitrev}%{!?gitrev:0}
Summary:        Prey anti-theft agent (bundled Node.js %{node_ver})
License:        GPL-3.0-only AND MIT AND BSD-3-Clause AND ISC AND Apache-2.0
URL:            https://github.com/prey/prey-node-client
Source0:        prey-%{version}-vendored.tar.xz
Source1:        https://nodejs.org/dist/v%{node_ver}/node-v%{node_ver}-linux-x64.tar.xz
Source2:        prey.wrapper
Source3:        prey-agent.service
Source4:        prey.sysusers
Source5:        prey.tmpfiles
Source6:        prey.sudoers
Source7:        prey-xhost
Source8:        prey-xhost.desktop
ExclusiveArch:  x86_64

Requires(pre):  systemd
Requires(post): systemd coreutils sudo
Requires(posttrans): systemd coreutils
Requires(preun): systemd coreutils
Requires(postun): systemd
Requires:       sudo
Requires:       util-linux
Requires:       /usr/bin/su
Requires:       /usr/bin/lsb_release
Requires:       /usr/bin/dbus-monitor
Requires:       /usr/bin/loginctl
Requires:       /usr/bin/ps
Recommends:     dmidecode
Recommends:     NetworkManager
Recommends:     wireless-tools
Recommends:     upower
Recommends:     mpg123
Recommends:     zenity
Recommends:     scrot
Recommends:     /usr/bin/pactl
Recommends:     /usr/bin/xhost
Recommends:     /usr/bin/streamer
Recommends:     libgtkmm-4.0.so.0()(64bit)
Recommends:     libwebkit2gtk-4.1.so.0()(64bit)
Recommends:     libjavascriptcoregtk-4.1.so.0()(64bit)

%description
Prey is an anti-theft and device-management agent: it reports location,
network and hardware data to the Prey control panel and can lock, sound an
alarm, take screenshots/pictures or wipe data on request.

This package installs the agent in /opt/prey with a bundled Node.js
%{node_ver} runtime, runs it as the unprivileged 'prey' user through the
prey-agent.service systemd unit, and provides the 'prey' command.
Link the device with: sudo prey config account authorize -a <API_KEY>

%prep
%setup -q -n prey-%{version}
rm -rf ../node-v%{node_ver}
mkdir -p ../node-v%{node_ver}
tar -xJf %{SOURCE1} -C ../node-v%{node_ver} --strip-components=1 \
    node-v%{node_ver}-linux-x64/bin/node node-v%{node_ver}-linux-x64/LICENSE
install -m 0755 ../node-v%{node_ver}/bin/node bin/node
cp -p ../node-v%{node_ver}/LICENSE LICENSE.node

%build
test "$(bin/node --version)" = "v%{node_ver}"
bin/node -e "new (require('./node_modules/sqlite3').Database)(':memory:').close()"

%install
install -d -m 0755 %{buildroot}/opt/prey
cp -a bin lib node_modules package.json package-lock.json prey.conf.default \
      LICENSE README.md %{buildroot}/opt/prey/
install -D -m 0755 %{SOURCE2} %{buildroot}/usr/bin/prey
install -D -m 0644 %{SOURCE3} %{buildroot}/usr/lib/systemd/system/prey-agent.service
install -D -m 0644 %{SOURCE4} %{buildroot}/usr/lib/sysusers.d/prey.conf
install -D -m 0644 %{SOURCE5} %{buildroot}/usr/lib/tmpfiles.d/prey.conf
install -D -m 0440 %{SOURCE6} %{buildroot}/etc/sudoers.d/51_prey_switcher
install -D -m 0755 %{SOURCE7} %{buildroot}/usr/libexec/prey/prey-xhost
install -D -m 0644 %{SOURCE8} %{buildroot}/etc/xdg/autostart/prey-xhost.desktop
install -d -m 0755 %{buildroot}/etc/prey
install -d -m 0755 %{buildroot}/var/log
touch %{buildroot}/var/log/prey.log

%pre
systemd-sysusers --replace=/usr/lib/sysusers.d/prey.conf - <<'EOF' >/dev/null 2>&1 || :
%(cat %{SOURCE4})
EOF
getent passwd prey >/dev/null || { echo "prey: cannot create system user 'prey'" >&2; exit 1; }

%post
systemd-tmpfiles --create /usr/lib/tmpfiles.d/prey.conf >/dev/null 2>&1 || :
[ -e /etc/prey/prey.conf ] || install -m 0644 -o prey -g prey /opt/prey/prey.conf.default /etc/prey/prey.conf || :
[ -e /etc/prey/commands.db ] || install -m 0644 -o prey -g prey /dev/null /etc/prey/commands.db || :
chown -R -h prey:prey /etc/prey 2>/dev/null || :
if command -v visudo >/dev/null 2>&1 && [ -e /etc/sudoers.d/51_prey_switcher ] \
   && ! visudo -cq -f /etc/sudoers.d/51_prey_switcher >/dev/null 2>&1; then
  echo "prey: sudoers drop-in invalid, disabling it" >&2
  mv -f /etc/sudoers.d/51_prey_switcher /etc/sudoers.d/51_prey_switcher.rpm-invalid || :
fi
if [ -e /etc/systemd/system/prey-agent.service ]; then
  echo "prey: WARNING /etc/systemd/system/prey-agent.service overrides the packaged unit; remove it" >&2
fi
if [ "$1" -eq 1 ]; then
  touch /run/prey.rpm-fresh-install 2>/dev/null || :
fi
exit 0

%posttrans
fresh=0
if [ -e /run/prey.rpm-fresh-install ]; then
  fresh=1
  rm -f /run/prey.rpm-fresh-install
fi
if [ -n "${API_KEY:-}" ]; then
  echo "prey: linking this device to the account of the given API_KEY..."
  timeout 300 /opt/prey/bin/prey config account authorize -a "$API_KEY" \
    || echo "prey: linking failed; run: sudo prey config account authorize -a <API_KEY>" >&2
  chown -R -h prey:prey /etc/prey 2>/dev/null || :
fi
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload >/dev/null 2>&1 || :
  if [ "$fresh" -eq 1 ]; then
    systemctl enable --now prey-agent.service >/dev/null 2>&1 || :
  else
    systemctl try-restart prey-agent.service >/dev/null 2>&1 || :
  fi
elif [ "$fresh" -eq 1 ]; then
  systemctl enable prey-agent.service >/dev/null 2>&1 || :
fi
if [ "$fresh" -eq 1 ]; then
  cat <<'EOF'

Prey is installed and prey-agent.service is enabled.
Link this device to your Prey account (API key from the Prey web panel):
    sudo prey config account authorize -a <API_KEY>
  or use the graphical setup:
    sudo prey config panel
Until it is linked the agent exits and systemd restarts it every ~2 minutes.
Log out and back in once so the desktop session grants the agent X access.
Do NOT run 'prey config hooks post_install' (this package already did the setup).
EOF
fi
exit 0

%preun
if [ "$1" -eq 0 ]; then
  if [ -d /run/systemd/system ]; then
    systemctl disable --now prey-agent.service >/dev/null 2>&1 || :
  else
    systemctl disable prey-agent.service >/dev/null 2>&1 || :
  fi
  timeout 60 /opt/prey/bin/prey config hooks pre_uninstall >/dev/null 2>&1 || :
fi
exit 0

%postun
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload >/dev/null 2>&1 || :
fi
if [ "$1" -eq 0 ]; then
  echo "prey: kept /etc/prey (device identity) and user 'prey'. Purge: rm -rf /etc/prey && userdel prey"
fi
exit 0

%files
%license LICENSE LICENSE.node
/opt/prey
/usr/bin/prey
%dir /usr/libexec/prey
/usr/libexec/prey/prey-xhost
/etc/xdg/autostart/prey-xhost.desktop
/usr/lib/systemd/system/prey-agent.service
/usr/lib/sysusers.d/prey.conf
/usr/lib/tmpfiles.d/prey.conf
%config(noreplace) %attr(0440,root,root) /etc/sudoers.d/51_prey_switcher
%dir %attr(0755,prey,prey) /etc/prey
%ghost %attr(0640,prey,prey) %verify(not md5 size mtime) /var/log/prey.log
