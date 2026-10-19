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

describe('system/paths - deriveWindowsConfigPaths', () => {
  it('exposes the helper', () => {
    expect(derive).to.be.a('function');
  });

  it('anchors config/log to the install dir on managed Windows installs when data is present', () => {
    const install = path.join('custom', 'install', 'Prey');
    const res = derive('windows', install, true, true);
    expect(res).to.deep.equal({
      config: install,
      log: install,
      log_file: path.join(install, 'prey.log'),
      log_restarts: path.join(install, 'prey_restarts.log'),
    });
  });

  it('does NOT anchor when the data is not yet present in the install dir', () => {
    // This is the safe-by-default case: an existing install being upgraded whose data
    // still lives under %WINDIR%\Prey must keep using the default, not an empty dir.
    const install = path.join('custom', 'install', 'Prey');
    expect(derive('windows', install, true, false)).to.be.null;
  });

  it('is a no-op (returns the same dir) for a standard install path with data present', () => {
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
