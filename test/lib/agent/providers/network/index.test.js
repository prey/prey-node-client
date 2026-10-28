/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable camelcase */
const { expect } = require('chai');

// Absolute ids so we can swap the 'network' dependency in the require cache and
// force a fresh load of the provider that picks up the stub.
const NETWORK_ID = require.resolve('network');
const PROVIDER_PATH = '../../../../../lib/agent/providers/network';
const PROVIDER_ID = require.resolve(PROVIDER_PATH);

/**
 * Loads a fresh copy of the network provider with `require('network')` replaced
 * by the given stub. Restores the real module afterwards so other suites are
 * unaffected.
 * @param {object} networkStub
 * @returns {object} the freshly-loaded provider module
 */
const loadProviderWith = (networkStub) => {
  const originalNetwork = require.cache[NETWORK_ID];
  require.cache[NETWORK_ID] = {
    id: NETWORK_ID,
    filename: NETWORK_ID,
    loaded: true,
    exports: networkStub,
    // @ts-ignore - partial Module shape is enough for require() resolution
    children: [],
  };
  delete require.cache[PROVIDER_ID];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const provider = require(PROVIDER_PATH);

  if (originalNetwork) require.cache[NETWORK_ID] = originalNetwork;
  else delete require.cache[NETWORK_ID];
  delete require.cache[PROVIDER_ID];

  return provider;
};

// Mimics os.networkInterfaces() throwing synchronously on Windows
// (uv_interface_addresses returned Unknown system error 2).
const throwSystemError = () => {
  const err = new Error('uv_interface_addresses returned Unknown system error 2');
  // @ts-ignore - code is a standard Node SystemError field
  err.code = 'ERR_SYSTEM_ERROR';
  throw err;
};

describe('Network provider getters — sync throw guard', () => {
  describe('when the underlying network getter throws synchronously', () => {
    let provider;

    beforeEach(() => {
      provider = loadProviderWith({
        get_private_ip: throwSystemError,
        get_public_ip: throwSystemError,
        get_gateway_ip: throwSystemError,
        get_active_interface: throwSystemError,
      });
    });

    it('get_private_ip delivers a controlled error instead of throwing', () => {
      let received;
      expect(() => provider.get_private_ip((err) => { received = err; })).to.not.throw();
      expect(received).to.be.an('error');
      // level marks it as known/expected so exceptions.send skips it
      expect(received.level).to.equal('not fatal');
    });

    it('get_public_ip delivers a controlled error instead of throwing', () => {
      let received;
      expect(() => provider.get_public_ip({}, (err) => { received = err; })).to.not.throw();
      expect(received).to.be.an('error');
      expect(received.level).to.equal('not fatal');
    });

    it('get_gateway_ip delivers a controlled error instead of throwing', () => {
      let received;
      expect(() => provider.get_gateway_ip((err) => { received = err; })).to.not.throw();
      expect(received).to.be.an('error');
      expect(received.level).to.equal('not fatal');
    });

    it('get_active_network_interface delivers a controlled error instead of throwing', () => {
      let received;
      const invoke = () => provider.get_active_network_interface((err) => { received = err; });
      expect(invoke).to.not.throw();
      expect(received).to.be.an('error');
      expect(received.level).to.equal('not fatal');
    });
  });

  describe('happy path — underlying getter succeeds', () => {
    it('get_private_ip forwards the resolved value untouched', () => {
      const provider = loadProviderWith({
        get_private_ip: (cb) => cb(null, '192.168.1.42'),
        get_public_ip: (options, cb) => cb(null, '8.8.8.8'),
        get_gateway_ip: (cb) => cb(null, '192.168.1.1'),
        get_active_interface: (cb) => cb(null, { name: 'Ethernet' }),
      });

      let error;
      let value;
      provider.get_private_ip((err, data) => { error = err; value = data; });
      expect(error).to.not.exist;
      expect(value).to.equal('192.168.1.42');
    });
  });
});
