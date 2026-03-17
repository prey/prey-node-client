# Uninstall Process by Operating System

This document describes how the Prey client uninstall flow works on Linux, macOS, and Windows, based on the current implementation.

## 1. Entry point

- The npm uninstall script runs: ./bin/prey config hooks pre_uninstall.
- That CLI command calls the main pre_uninstall task in lib/conf/tasks/index.js.
- If it is run from npm without the required privileges (without --unsafe-perm where applicable), the CLI stops execution to avoid leaving service artifacts behind.

## 2. Shared orchestration (all OSes)

The pre_uninstall task reads the -u/--updating flag to distinguish update flow from a real uninstall:

- updating = true:
  - Runs only:
    - daemon.remove
    - osHooks.pre_uninstall
  - Does not run deep cleanup or module deactivation.

- updating = false (real uninstall):
  - Always runs:
    - daemon.remove
    - osHooks.pre_uninstall
    - osHooks.deleteOsquery
  - On macOS, it also runs first:
    - prey_owl.remove_watcher
  - On Windows, it also runs:
    - osHooks.deletePreyFenix
    - osHooks.deep_cleanup
  - If api and device keys exist, it sends an uninstalled event to the backend.

## 3. Linux

### 3.1 OS-specific hook

- lib/conf/tasks/os/linux.js defines empty uninstall hooks:
  - pre_uninstall: no-op
  - deleteOsquery: no-op

### 3.2 Service removal (daemon.remove)

- The daemon is destroyed with satan.ensure_destroyed using the prey-agent key.
- There is no extra directory, temp, or registry cleanup in Linux hooks.

Practical result:
- On Linux, uninstall focuses on stopping/removing the daemon and finishing the shared flow, with no additional deep cleanup routine in that OS hook file.

## 4. macOS

### 4.1 OS-specific hook

- lib/conf/tasks/os/mac.js:
  - pre_uninstall: no-op
  - deleteOsquery: runs trinity --uninstall from paths.current/bin/trinity

### 4.2 macOS watcher (prey_owl)

Before daemon.remove, orchestration runs prey_owl.remove_watcher:

- destroys com.prey.new_owl and com.prey.owl watchers
- removes the watcher user via dscl at /Users/preyowl

### 4.3 Service removal (daemon.remove)

- Destroys daemon com.prey.agent.

Practical result:
- macOS removes the helper watcher, removes the daemon, and uninstalls osquery through trinity on real uninstall.

## 5. Windows

Windows has the most complete and aggressive cleanup logic.

### 5.1 pre_uninstall hook (os/windows.js)

osHooks.pre_uninstall runs:

- Removal of historical firewall rules associated with installed versions.
- Stop and delete of CronService:
  - sc.exe config CronService start= disabled
  - sc.exe stop CronService
  - sc.exe delete CronService
- Process termination:
  - taskkill /f /im wpxsvc.exe
  - Stop-Process for wpxsvc and node (PowerShell)
- Cleanup of auxiliary node service via deleteNodeService(paths.current).

### 5.2 Additional hooks on real uninstall

Only when updating = false:

- deletePreyFenix:
  - schtasks.exe /Delete /TN "Prey Fenix" /F
- deleteOsquery:
  - runs paths.current\\bin\\trinity --uninstall
- deep_cleanup:
  - Cleans detected install directories (registry + fallback + paths.install)
  - Cleans temp files (TEMP and C:\\Windows\\Temp using prey* pattern)
  - Removes registry keys:
    - HKLM\\SOFTWARE\\Prey
    - HKCU\\Software\\Prey

### 5.3 Service removal (daemon.remove)

- Destroys daemon CronService.
- If applicable, removes the runtime-copied service binary (wpxsvc.exe in paths.install).

Practical result:
- On real Windows uninstall, it removes service, scheduled tasks, firewall rules, osquery, disk artifacts, temp files, and registry entries.

## 6. Key difference: update vs real uninstall

- Update (updating=true): skips deep cleanup and skips auxiliary module deactivation.
- Real uninstall (updating=false): performs full cleanup, including osquery and OS-specific extra tasks (especially on Windows).

## 7. Test evidence

Relevant unit tests for this flow are located at:

- test/lib/conf/tasks/index.pre_uninstall.test.js
- test/lib/conf/tasks/os/windows.test.js

These tests validate:

- inclusion/exclusion of deep_cleanup based on updating flag
- execution of deletePreyFenix/deleteOsquery on real Windows uninstall
- hard-stop sequence and deep cleanup behavior on Windows

## 8. Additional Windows Analysis from Prey Client Distribution

This section complements the previous Windows section.

Scope note:
- The analysis below was performed on March 17, 2026.
- It belongs to the prey-client-distribution project (installer build repository), not prey-node-client.
- It is included here as cross-repository context for Windows uninstall behavior.

### 8.1 Executive summary

Windows uninstall currently has 3 relevant paths:

1. Node client NSIS EXE uninstall: node-client/windows/installer.nsi (around line 366)
2. Node client MSI (WiX) uninstall: node-client/windows/msi/prey_msi_main.wxs (around line 193)
3. Legacy bash-client NSIS uninstall: bash-client/windows/installer.nsi (around line 427)

The MSI definition used by the standard build pipeline is node-client/windows/msi/prey_msi_main.wxs, confirmed in node-client/windows/build_msi.cmd (around line 49).

### 8.2 Node Client NSIS uninstall flow (EXE)

Reference: node-client/windows/installer.nsi (around line 344)

1. Uninstaller init checks admin rights.
2. Reads install directory from HKLM Software\Prey.
3. Shows user confirmation prompt.

Uninstall section:
1. Reads ProductCode from registry.
2. Calls MSI uninstall silently via msiexec /x (with or without UPDATING=1).
3. Aborts if msiexec fails.
4. Performs additional cleanup of folders/files.
5. Force-deletes HKLM/HKCU Software\Prey keys.

Key point:
- NSIS primarily delegates uninstall to MSI, then performs hard cleanup.

### 8.3 Node Client MSI uninstall flow (WiX)

Reference: node-client/windows/msi/prey_msi_main.wxs (around line 193)

InstallExecuteSequence for REMOVE="ALL":
1. Runs pre-uninstall hook via prey.cmd.
2. Runs a second pre-uninstall call path.
3. Disables CronService startup.
4. Kills wpxsvc.exe and node.exe.
5. Deletes CronService with sc delete.
6. Deletes install directory and C:\Windows\Prey.
7. Deletes HKLM/HKCU Software\Prey keys.

Key point:
- Most uninstall CustomActions use Return="ignore", so failures may be silent.

### 8.4 Legacy bash-client uninstall flow (NSIS)

Reference: bash-client/windows/installer.nsi (around line 368)

1. Checks admin rights and asks for confirmation.
2. In non-silent mode, asks owner verification (email/API key).
3. Kills openssl/bash processes.
4. Removes cron and service using macros.
5. Removes install tree and registry remnants.

### 8.5 Silent/manual uninstall commands

1. Manual MSI uninstall by ProductCode is documented at node-client/windows/README.md (around line 92).
2. Upgrade path internally uses silent uninstall flags /S and /UPDATING=1 in NSIS.
3. Silent install commands are documented in node-client/UNATTENDED.md (around line 33).

### 8.6 Risks and inconsistencies

1. Error handling mismatch:
NSIS aborts on uninstall failure, while MSI often ignores failures.

2. Potential duplicate pre-uninstall execution in MSI:
Two separate pre-uninstall actions exist under REMOVE="ALL".

3. Limited observability during silent cleanup:
taskkill, sc, reg, and rd calls redirect output and ignore many errors, making troubleshooting harder.

4. Interactive prompt behavior in NSIS un.onInit:
Confirmation is explicitly shown in un.onInit; silent-mode behavior depends on NSIS runtime behavior.

### 8.7 Conclusion

The uninstall logic is resilient in practice because it uses multiple cleanup layers (MSI plus NSIS cleanup), but consistency and diagnosability can be improved.

Highest-impact improvements:
1. Align failure strategy between NSIS and MSI (fail-fast vs best-effort).
2. Remove or justify duplicated pre-uninstall hook calls in MSI.
3. Improve uninstall logging/telemetry for silent runs.
