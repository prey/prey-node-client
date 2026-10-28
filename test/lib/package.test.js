const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const needle = require('needle');
const common = require('../../lib/agent/common');

// OWCA-639: releases.get_stable_version must never inject an `undefined`
// user-agent header into needle, which throws ERR_HTTP_INVALID_HEADER_VALUE.
//
// lib/utils/configfile exports a frozen singleton (Object.freeze), so its
// `load`/`getData` cannot be stubbed by sinon. get_stable_version requires it
// lazily, so we swap the module in require.cache for a fake (restored after).
describe('lib/package - releases.get_stable_version (OWCA-639)', () => {
  const configPath = require.resolve('../../lib/utils/configfile');
  let originalConfigCache;
  let fakeConfig;
  let packageMod;
  let releases;
  let needleGetStub;

  beforeEach(() => {
    originalConfigCache = require.cache[configPath];
    fakeConfig = {
      load: (cb) => cb(),
      getData: sinon.stub(),
    };
    require.cache[configPath] = {
      id: configPath,
      filename: configPath,
      loaded: true,
      exports: fakeConfig,
      children: [],
      paths: [],
    };

    packageMod = rewire('../../lib/package');
    releases = packageMod.__get__('releases');
    needleGetStub = sinon.stub(needle, 'get')
      .callsFake((url, opts, cb) => { if (typeof cb === 'function') cb(null, { statusCode: 200 }, 'body'); });
  });

  afterEach(() => {
    if (originalConfigCache) require.cache[configPath] = originalConfigCache;
    else delete require.cache[configPath];
    sinon.restore();
  });

  it('never passes an undefined header value when user_agent is undefined and a device key exists', () => {
    fakeConfig.getData.returns('DEVICEKEY123');
    sinon.stub(common.system, 'user_agent').value(undefined);

    releases.get_stable_version(() => {});

    expect(needleGetStub.calledOnce).to.be.true;
    const options = needleGetStub.args[0][1];
    // Device key present => an options object (not null) must be used.
    expect(options).to.be.an('object');
    expect(options.headers).to.be.an('object');
    // The crux of the bug: no header value may be `undefined`.
    Object.values(options.headers).forEach((value) => {
      expect(value).to.not.be.undefined;
    });
  });

  it('includes the user-agent header when it is defined', () => {
    fakeConfig.getData.returns('DEVICEKEY123');
    sinon.stub(common.system, 'user_agent').value('Prey/1.2.3 (Node vX Linux 22.04)');

    releases.get_stable_version(() => {});

    expect(needleGetStub.calledOnce).to.be.true;
    const options = needleGetStub.args[0][1];
    expect(options.headers['user-agent']).to.equal('Prey/1.2.3 (Node vX Linux 22.04)');
    expect(options.headers['resource-dk']).to.equal('DEVICEKEY123');
  });

  it('passes null options when no device key is present', () => {
    fakeConfig.getData.returns(null);
    sinon.stub(common.system, 'user_agent').value(undefined);

    releases.get_stable_version(() => {});

    expect(needleGetStub.calledOnce).to.be.true;
    expect(needleGetStub.args[0][1]).to.equal(null);
  });
});
