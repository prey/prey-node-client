%global debug_package %{nil}
%global __os_install_post %{nil}
%{!?dummy_release: %global dummy_release 1}

Name:           prey
Version:        1.13.41
Release:        0.dummy%{dummy_release}
Summary:        DUMMY prey package for harness validation
License:        GPL-3.0-only
URL:            https://preyproject.com
AutoReqProv:    no
Requires:       sudo
Requires:       util-linux
Requires:       /usr/bin/su
Requires:       /usr/bin/lsb_release
Requires:       /usr/bin/dbus-monitor
Requires:       /usr/bin/loginctl
Requires:       /usr/bin/ps
Requires(pre):  /usr/bin/systemd-sysusers
Requires(post): /usr/bin/systemd-tmpfiles
Recommends:     dmidecode

%description
Dummy package mimicking the prey RPM layout (systemd unit, sysusers, tmpfiles,
sudoers drop-in, /etc/prey) so the container test harness can be exercised.

%prep
%build

%install
set -e
B=%{buildroot}
install -d $B/opt/prey/bin $B/opt/prey/lib/agent/actions/lock/linux \
  $B/opt/prey/lib/conf/panel/linux $B/opt/prey/node_modules/sqlite3/build/Release \
  $B/usr/bin $B/usr/lib/sysusers.d $B/usr/lib/tmpfiles.d $B/usr/lib/systemd/system \
  $B/etc/sudoers.d $B/etc/prey $B/usr/libexec/prey $B/etc/xdg/autostart $B/var/log

cat > $B/opt/prey/bin/node <<'EOF'
#!/bin/sh
[ "$1" = "--version" ] && echo v22.23.0 && exit 0
# emulate the harness' "can node load sqlite3" probe
case "$2" in *sqlite3-loaded*) echo sqlite3-loaded; exit 0 ;; esac
echo "dummy node" ; exit 0
EOF

cat > $B/opt/prey/bin/prey <<'EOF'
#!/bin/bash
# dummy launcher
case "$1" in
  -N|--node-version) exec /opt/prey/bin/node --version ;;
  -V|--version) echo 1.13.41; exit 0 ;;
  config)
    case "$2" in
      check) echo "Checking installation."; echo "Error: No API key found."; exit 1 ;;
      hooks) echo "dummy hooks $3"; exit 0 ;;
      *) echo "Usage: prey config [command]"; exit 0 ;;
    esac ;;
esac
echo "$(date '+%%F %%T') - WARN  - Not configured. (dummy agent pid $$ as $(id -un))" >> /var/log/prey.log
echo "Not configured. (dummy)"
exec sleep infinity
EOF

cat > $B/usr/bin/prey <<'EOF'
#!/bin/sh
exec /opt/prey/bin/prey "$@"
EOF

cp /usr/bin/true $B/opt/prey/lib/agent/actions/lock/linux/prey-lock-gtk4
cp /usr/bin/true $B/opt/prey/lib/conf/panel/linux/prey-config-gtk4
patchelf --add-needed libgtk-4.so.1 $B/opt/prey/lib/agent/actions/lock/linux/prey-lock-gtk4
patchelf --add-needed libgtk-4.so.1 $B/opt/prey/lib/conf/panel/linux/prey-config-gtk4
cp -L /usr/lib64/libz.so.1 $B/opt/prey/node_modules/sqlite3/build/Release/node_sqlite3.node
echo '{"name":"prey","version":"1.13.41"}' > $B/opt/prey/package.json

cat > $B/usr/lib/sysusers.d/prey.conf <<'EOF'
u prey - "Prey Anti-Theft" - /usr/sbin/nologin
m prey video
m prey audio
EOF
echo 'f /var/log/prey.log 0640 prey prey -' > $B/usr/lib/tmpfiles.d/prey.conf

cat > $B/usr/lib/systemd/system/prey-agent.service <<'EOF'
[Unit]
Description=Prey anti-theft agent (DUMMY)
After=network.target

[Service]
User=prey
Group=prey
ExecStart=/opt/prey/bin/prey
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > $B/etc/sudoers.d/51_prey_switcher <<'EOF'
Defaults:prey env_keep += "DISPLAY XAUTHORITY"
prey ALL=(ALL) NOPASSWD: /usr/bin/su [A-z]*, !/usr/bin/su root*, !/usr/bin/su -*
EOF
chmod 0440 $B/etc/sudoers.d/51_prey_switcher

printf 'auto_connect = false\nhost = solid.preyproject.com\napi_key = \ndevice_key = \n' > $B/opt/prey/prey.conf.default
printf '#!/bin/sh\nexit 0\n' > $B/usr/libexec/prey/prey-xhost
printf '[Desktop Entry]\nType=Application\nName=Prey xhost\nExec=/usr/libexec/prey/prey-xhost\nNoDisplay=true\n' \
  > $B/etc/xdg/autostart/prey-xhost.desktop
touch $B/var/log/prey.log
chmod 0755 $B/opt/prey/bin/node $B/opt/prey/bin/prey $B/usr/bin/prey $B/usr/libexec/prey/prey-xhost

%pre
systemd-sysusers /usr/lib/sysusers.d/prey.conf 2>/dev/null || \
  printf 'u prey - "Prey Anti-Theft" - /usr/sbin/nologin\nm prey video\nm prey audio\n' | systemd-sysusers -
if [ "$1" -gt 1 ]; then mkdir -p /var/lib/rpm-state/prey && touch /var/lib/rpm-state/prey/upgrade; fi
exit 0

%post
systemd-tmpfiles --create /usr/lib/tmpfiles.d/prey.conf || :
if [ ! -e /etc/prey/prey.conf ]; then
  install -o prey -g prey -m 0640 /opt/prey/prey.conf.default /etc/prey/prey.conf
fi
if [ ! -e /etc/prey/commands.db ]; then
  install -o prey -g prey -m 0640 /dev/null /etc/prey/commands.db
fi
exit 0

%posttrans
systemctl daemon-reload >/dev/null 2>&1 || :
if [ -e /var/lib/rpm-state/prey/upgrade ]; then
  rm -f /var/lib/rpm-state/prey/upgrade
  systemctl try-restart prey-agent.service || :
else
  systemctl enable --now prey-agent.service || :
fi
exit 0

%preun
if [ "$1" -eq 0 ]; then
  systemctl disable --now prey-agent.service || :
  /opt/prey/bin/prey config hooks pre_uninstall || :
fi
exit 0

%postun
systemctl daemon-reload >/dev/null 2>&1 || :
exit 0

%files
%defattr(-,root,root,-)
%dir /opt/prey
/opt/prey/bin
/opt/prey/lib
/opt/prey/node_modules
/opt/prey/package.json
/opt/prey/prey.conf.default
/usr/bin/prey
/usr/lib/sysusers.d/prey.conf
/usr/lib/tmpfiles.d/prey.conf
/usr/lib/systemd/system/prey-agent.service
%attr(0440,root,root) %config(noreplace) /etc/sudoers.d/51_prey_switcher
%dir %attr(0755,prey,prey) /etc/prey
%dir /usr/libexec/prey
/usr/libexec/prey/prey-xhost
/etc/xdg/autostart/prey-xhost.desktop
%ghost %attr(0640,prey,prey) /var/log/prey.log

%changelog
* Tue Oct 20 2026 Test Harness <noreply@example.com> - 1.13.41-0.dummy1
- Dummy fixture
