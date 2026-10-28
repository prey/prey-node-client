/* eslint-disable no-unused-expressions */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */
const { expect } = require('chai');
const rewire = require('rewire');
const path = require('path');

// Requiring the module runs its runtime path detection, but we only exercise the
// pure derivation helper (via rewire) here, so no filesystem mocking is needed.
const pathsModule = rewire('../../../lib/system/paths');
const derive = pathsModule.__get__('deriveWindowsConfigPaths');
const shouldAnchor = pathsModule.__get__('shouldAnchorWindows');

describe('system/paths - deriveWindowsConfigPaths', () => {
  it('exposes the helper', () => {
    expect(derive).to.be.a('function');
  });

  it('anchors config/log to the install dir on managed Windows installs when anchoring', () => {
    const install = path.join('custom', 'install', 'Prey');
    const res = derive('windows', install, true, true);
    expect(res).to.deep.equal({
      config: install,
      log: install,
      log_file: path.join(install, 'prey.log'),
      log_restarts: path.join(install, 'prey_restarts.log'),
    });
  });

  it('does NOT anchor when anchoring is disabled', () => {
    // Safe-by-default case: an existing install being upgraded whose data still lives
    // under %WINDIR%\Prey must keep using the default, not an empty custom dir.
    const install = path.join('custom', 'install', 'Prey');
    expect(derive('windows', install, true, false)).to.be.null;
  });

  it('is a no-op (returns the same dir) for a standard install path when anchoring', () => {
    // On a standard Windows install, install === %WINDIR%\Prey, so config is unchanged.
    const install = path.join('WINDIR', 'Prey');
    const res = derive('windows', install, true, true);
    expect(res.config).to.equal(install);
    expect(res.log_file).to.equal(path.join(install, 'prey.log'));
  });

  it('returns null for unmanaged/dev layouts (not current/versions)', () => {
    expect(derive('windows', path.join('some', 'repo'), false, true)).to.be.null;
  });

  it('returns null on non-Windows platforms', () => {
    expect(derive('mac', '/etc/prey', true, true)).to.be.null;
    expect(derive('linux', '/etc/prey', true, true)).to.be.null;
  });
});

describe('system/paths - shouldAnchorWindows', () => {
  it('exposes the helper', () => {
    expect(shouldAnchor).to.be.a('function');
  });

  // Signature: shouldAnchorWindows(targetOs, managed, dbInInstall, dbInLegacy)

  it('anchors a fresh standard install (no db anywhere)', () => {
    // install === legacy === %WINDIR%\Prey: anchoring is a no-op but still true.
    expect(shouldAnchor('windows', true, false, false)).to.be.true;
  });

  it('anchors a fresh custom install (no db anywhere) — the fix', () => {
    // Custom install root, nothing migrated yet, and no legacy data to protect:
    // the db must land in the custom install root alongside prey.conf/prey.log.
    expect(shouldAnchor('windows', true, false, false)).to.be.true;
  });

  it('anchors an upgrade of a standard install (db in both install and legacy)', () => {
    expect(shouldAnchor('windows', true, true, true)).to.be.true;
  });

  it('does NOT anchor an upgrade with legacy data but an empty custom install root', () => {
    // The running device keeps reading its data from %WINDIR%\Prey (identity preserved).
    expect(shouldAnchor('windows', true, false, true)).to.be.false;
  });

  it('does NOT anchor a reinstall over leftover legacy data (reuse legacy, keep identity)', () => {
    expect(shouldAnchor('windows', true, false, true)).to.be.false;
  });

  it('anchors a custom install already migrated (db in install root)', () => {
    expect(shouldAnchor('windows', true, true, false)).to.be.true;
  });

  it('does NOT anchor for unmanaged/dev layouts', () => {
    expect(shouldAnchor('windows', false, false, false)).to.be.false;
    expect(shouldAnchor('windows', false, true, false)).to.be.false;
  });

  it('does NOT anchor on non-Windows platforms', () => {
    expect(shouldAnchor('mac', true, false, false)).to.be.false;
    expect(shouldAnchor('linux', true, true, false)).to.be.false;
  });
});
