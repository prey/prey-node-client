# Pacote RPM do agente Prey

Um único RPM **x86_64** que instala no **openSUSE Tumbleweed** e no **Fedora 42/43**.
O upstream só publica um `.deb` para Ubuntu; este diretório gera o equivalente em RPM.

| Arquivo | Destino no sistema |
|---|---|
| `prey.spec` | spec do pacote |
| `make-rpm.sh` | script de build (stage + `npm ci` + `rpmbuild`) |
| `prey.wrapper` | `/usr/bin/prey` |
| `prey-agent.service` | `/usr/lib/systemd/system/prey-agent.service` |
| `prey.sysusers` | `/usr/lib/sysusers.d/prey.conf` (usuário `prey`, grupos `video`/`audio`) |
| `prey.tmpfiles` | `/usr/lib/tmpfiles.d/prey.conf` (`/var/log/prey.log`) |
| `prey.sudoers` | `/etc/sudoers.d/51_prey_switcher` (0440, `%config(noreplace)`) |
| `prey-xhost`, `prey-xhost.desktop` | `/usr/libexec/prey/prey-xhost`, `/etc/xdg/autostart/` |
| `tests/` | testes de instalação em containers (mantidos à parte) |

## Pré-requisitos (máquina de build)

- x86_64, `git`, `curl`, `tar`, `xz`, `file`, `sha256sum`.
- `rpmbuild` no host **ou** Docker/Podman (`DOCKER=podman`). Sem `rpmbuild`, o script
  cria uma vez a imagem `prey-rpm-builder:tw` (Tumbleweed + `rpm-build`) e roda o
  `rpmbuild` nela, offline (`--network none`). A imagem é construída com
  `--network host` (mude com `PREY_RPM_BUILD_NETWORK=bridge` se preferir).
- Rede para baixar o Node.js 22.23.0 (conferido contra `SHASUMS256.txt` e um hash
  fixado no script) e as dependências npm. Nada é instalado no host; não precisa de `sudo`.

## Build

```sh
packaging/rpm/make-rpm.sh                 # árvore limpa
packaging/rpm/make-rpm.sh --allow-dirty   # aceita alterações não commitadas
RELEASE=2 packaging/rpm/make-rpm.sh       # nova release da mesma versão
```

Resultado: `dist/rpm/prey-<versão>-<release>.git<commit>.x86_64.rpm`.

- O código do app (`bin/ lib/ package*.json prey.conf.default LICENSE README.md`)
  vem **sempre do `HEAD`** do git; só os arquivos deste diretório vêm da árvore de
  trabalho. Commite antes de gerar o pacote.
- Caches: `node/v22.23.0/` (tarball + toolchain do Node usado pelo `npm ci`) e
  `dist/rpm/npm-cache/`. Ambos ignorados pelo git.
- O payload passa pela mesma limpeza do `tools/build.sh` (zip linux), sem binários
  macOS/Windows nem os helpers GTK3; o build falha se sobrar algum Mach-O/PE.

## Instalação

```sh
# openSUSE Tumbleweed
sudo zypper in --allow-unsigned-rpm ./dist/rpm/prey-*.x86_64.rpm
# Fedora 42/43
sudo dnf install ./dist/rpm/prey-*.x86_64.rpm
```

O serviço `prey-agent.service` é habilitado e iniciado na primeira instalação.

## Vincular o dispositivo à conta

```sh
sudo prey config account authorize -a <API_KEY>
# ou, pela interface gráfica:
sudo prey config panel
```

Também dá para vincular durante a instalação:
`sudo API_KEY=<API_KEY> zypper in --allow-unsigned-rpm ./prey-*.rpm` (ou `dnf install`).

Depois de instalar, faça logout/login uma vez na sessão gráfica (ver `prey-xhost`).

**Não** rode `prey config hooks post_install`: o pacote já faz essa configuração.

## Atualização

O auto-update do agente não funciona neste layout (instalação estática). Para
atualizar, gere um RPM novo (versão maior ou `RELEASE` maior) e instale por cima com
o mesmo comando de instalação. No upgrade o serviço só é reiniciado
(`try-restart`); a configuração em `/etc/prey` é preservada.

## Desinstalação

```sh
sudo zypper rm prey      # ou: sudo dnf remove prey
```

Antes de remover, o pacote para o serviço e roda `prey config hooks pre_uninstall`
(avisa o painel). `/etc/prey` (identidade do dispositivo) e o usuário `prey` são
mantidos para uma reinstalação. Para apagar tudo:

```sh
sudo rm -rf /etc/prey && sudo userdel prey
```

## O que o pacote instala

- `/opt/prey`: app + `node_modules` de produção + Node.js 22.23.0 (`bin/node`), tudo root:root.
- `/usr/bin/prey`: wrapper. Como root, `prey config ...` roda como root e depois
  devolve `/etc/prey` ao usuário `prey`; qualquer outro comando roda como `prey` (`runuser`).
- Usuário de sistema `prey` (via sysusers), membro de `video` e `audio`.
- `prey-agent.service` (`User=prey`, `Restart=always`, `KillMode=process`).
- `/etc/sudoers.d/51_prey_switcher`: `nmcli`, `iwlist`, `dmidecode` e `su <usuário>`
  sem senha para `prey`, mais `env_keep` das variáveis de display.
- `/etc/prey/` (dono `prey`), com `prey.conf` criado a partir de `prey.conf.default`.
- `/var/log/prey.log` (0640 prey:prey, via tmpfiles).
- Autostart de sessão `prey-xhost` (`xhost +SI:localuser:prey`).

## Limitações conhecidas

- Screenshot usa `scrot`, que só funciona em X11/Xwayland (não captura sessões Wayland nativas).
- O lock no KDE Wayland depende do protocolo `ext-session-lock-v1` do compositor.
- A extensão GNOME do lock (`preylock@preyproject.com`) não é instalada automaticamente.
- Auto-update desabilitado: atualize gerando um RPM novo.
- Só x86_64 (Node.js, `sqlite3` e os binários GTK4/wipe são x86_64).
- Enquanto o dispositivo não estiver vinculado, o agente sai e o systemd o reinicia
  a cada ~2 minutos. É esperado.
- O RPM não é assinado (`--allow-unsigned-rpm` no zypper; o `dnf` aceita pacote local).

## Decisões de design

- **`/opt/prey` e layout estático.** `lib/system/paths.js` trata como instalação
  estática qualquer diretório pai que não se chame `versions`. Em `/opt`, a política
  SELinux (Fedora e Tumbleweed em enforcing) rotula `/opt/prey/**/bin` como `bin_t`,
  então o systemd executa o serviço como `unconfined_service_t` sem regras extras.
- **Node.js embutido.** O agente roda no Node 22 oficial, não no Node do sistema
  (Tumbleweed já está no 26). Por isso `/usr/bin/prey` é um script e não um link:
  `bin/prey` escolhe `$dir/node` antes de resolver links, e um link usaria o node do sistema.
- **Sem `prey config hooks post_install`.** Usuário, unit, sudoers e tmpfiles são
  declarativos no RPM. O hook do upstream faria `echo "#includedir /etc/sudoers.d" >> /etc/sudoers`;
  no Tumbleweed (configuração do sudo em `/usr/etc/sudoers`) isso **cria** um
  `/etc/sudoers` de uma linha que substitui o padrão e tira o `sudo` dos administradores.
  Ele também gravaria uma unit concorrente em `/etc/systemd/system`.
- **sudoers.** O agente roda comandos gráficos com `sudo -n su <usuário> -c ...`; o
  `env_keep` garante `DISPLAY`/`XAUTHORITY`/`WAYLAND_DISPLAY`/... (o sudoers do
  openSUSE redefine `env_keep` sem elas). Caminhos `/usr/sbin` e `/usr/bin` cobrem o
  sbin merge do Fedora 42. O `%post` valida o arquivo com `visudo -c` e o desativa se for inválido.
- **Unit sem hardening.** `NoNewPrivileges=` quebraria o `sudo`; `PrivateTmp=`
  esconderia `/tmp/prey.pid`, usado pelo `prey config`.
- **`prey-xhost`.** O Xwayland do KWin só aceita o cookie em `/run/user/<uid>/xauth_*`,
  que o usuário `prey` não lê; liberar `SI:localuser` para `prey` e para o usuário da
  sessão resolve.
- **Dependências.** As dependências automáticas de `node_modules` e `lib/` são
  filtradas; só `bin/node` (glibc/libstdc++) e os shebangs geram `Requires`. Ferramentas
  opcionais (GTK4/WebKitGTK, `dmidecode`, `NetworkManager`, `scrot`, `xhost`, ...) são
  `Recommends`, resolvidas pelo nome de arquivo/soname nas duas distros.

## Solução de problemas

- **O agente reinicia a cada ~2,5 min.** É o esperado enquanto o dispositivo não está
  vinculado: o upstream encerra com `UNCAUGHT EXCEPTION: Not configured. Stopping.`
  (`lib/agent/control-panel/index.js`, `wait_for_config`) e o systemd o reinicia. Esse
  erro tem `level` definido, então não é enviado como relatório de crash. Vincule o
  dispositivo para parar o ciclo.
- **Serviço parado/desabilitado.** `sudo systemctl enable --now prey-agent`.
- **`prey -N` (e `-a -r -p -l -D`) não fazem nada.** Bug do upstream: o commander 9
  guarda as opções em `program.opts()`, mas `lib/agent/cli.js` lê `program.<opção>`.
  Sem um agente rodando, `prey -N` sobe um agente completo fora do systemd.

## Notas para um PR upstream

As correções em `lib/` deste branch são independentes do RPM e valem para qualquer
instalação estática ou distro não-Debian:

- `updater.check_for_update` sem diretório `versions` (crash com `ERR_INVALID_ARG_TYPE`).
- `find_admin_user`: parsing do `getent`, grupos `adm`/`wheel`/`sudo`, callback duplo.
- `create_user.sh`/`switcher.js`: nunca criar `/etc/sudoers`; `-G adm` só se o grupo existir.
- `setup_permissions`/`config activate`: não dar chown/chmod no diretório de instalação estático.
- `secure.open_config`: passar o ambiente da sessão via `env(1)` (o `env_reset` do sudo o descarta).
- `daemon.install`/`remove`: não mexer num serviço empacotado pela distro.
- `prey_user.touch`: não truncar o log.

Antes de abrir o PR: rebasear em `develop`, trocar `Refs: local-rpm-packaging` por uma
issue real e separar o empacotamento (`packaging/rpm/`) num PR à parte.

Bugs do upstream encontrados mas não corrigidos aqui:

- `satan` (prey/node-daemon), `lib/linux/backends/systemd.js`: `reload_all(cb)` é chamado
  como `reload_all(key, cb)`, o callback se perde e `ensure_created`/`ensure_destroyed`
  nunca retornam depois de recarregar units.
- `lib/agent/cli.js`: chamar `program.storeOptionsAsProperties()` (commander 9) para as
  opções `-N -a -r -p -l -D` voltarem a funcionar.
- Sugestão de refactor: os caminhos relativos profundos (`../../../../lib/...`) dos testes e
  de `lib/` poderiam usar *subpath imports* do Node (`"imports": {"#lib/*": "./lib/*.js"}`).
