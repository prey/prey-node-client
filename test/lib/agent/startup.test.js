/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const storage = require('../../../lib/agent/utils/storage');
const { ensureAndCreateDb } = require('../../../lib/agent/startup');

describe('startup.ensureAndCreateDb', () => {
  let order;

  beforeEach(() => {
    order = [];
    // Config dir and prey.conf already exist: only the DB steps run.
    sinon.stub(fs, 'existsSync').returns(true);
    sinon.stub(storage, 'migrateSchema').callsFake((cb) => {
      order.push('migrate');
      cb(null);
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('closes the connection opened by storage.init before migrating the schema', (done) => {
    const db = { close: sinon.stub().callsFake((cb) => { order.push('close'); cb(); }) };
    sinon.stub(storage, 'init').callsFake((type, path, cb) => cb(null, db));

    ensureAndCreateDb((err) => {
      expect(err).to.not.be.an('error');
      expect(storage.init.calledOnceWith(null, null)).to.be.true;
      expect(db.close.calledOnce).to.be.true;
      expect(order).to.deep.equal(['close', 'migrate']);
      done();
    });
  });

  it('still migrates and finishes when storage.init fails (best-effort)', (done) => {
    sinon.stub(storage, 'init').callsFake((type, path, cb) => cb(new Error('cannot open')));

    ensureAndCreateDb((err) => {
      expect(err).to.not.be.an('error');
      expect(order).to.deep.equal(['migrate']);
      done();
    });
  });
});
