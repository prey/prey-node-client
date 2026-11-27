/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable global-require */
const sinon = require('sinon');
const { expect } = require('chai');
const storage = require('../../../lib/agent/utils/storage');

const MODULE = '../../../lib/utils/skippedPermissions';

// skippedPermissions only loads on mac, reading the platform when the module is
// required, and its constructor calls load() right away (agent boot). A corrupt row
// used to throw from the storage callback there and crash-loop the agent.
describe('skippedPermissions load (mac) with an unreadable row', () => {
  const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  let storageStub;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    delete require.cache[require.resolve(MODULE)];
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', realPlatform);
    delete require.cache[require.resolve(MODULE)];
    storageStub.restore();
  });

  it('rewrites the row with the current values instead of throwing', (done) => {
    storageStub = sinon.stub(storage, 'do').callsFake((method, params, cb) => {
      if (method === 'query') return cb(null, [{ id: 'skippedPermissions', value: '{"camera":"tr' }]);
      return cb(null);
    });

    const skipped = require(MODULE);
    skipped.load(() => {
      const sets = storageStub.getCalls().filter((c) => c.args[0] === 'set');
      expect(sets, 'row rewritten').to.not.be.empty;
      expect(sets[0].args[1].id).to.equal('skippedPermissions');
      expect(JSON.parse(sets[0].args[1].data.value)).to.deep.equal({
        camera: 'false', screenshot: 'false', location: 'false',
      });
      done();
    });
  });
});
