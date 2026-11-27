/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const storage = require('../../../../lib/agent/utils/storage');
const secure = require('../../../../lib/agent/control-panel/secure');

// An unescaped `'--` in an exceptions quota UPDATE used to overwrite every keys row,
// the stored key pair included. Loading that pair made JSEncrypt throw a string from
// the storage callback, so the agent crashed on every boot.
describe('secure.generate_keys', function () {
  this.timeout(20000);
  const CORRUPT = '{"date":"2026-11-27","total":5,"errors":{"unknown option ';
  let stored;
  let storageStub;

  beforeEach(() => {
    stored = {};
    storageStub = sinon.stub(storage, 'do').callsFake((op, opts, cb) => {
      if (op === 'all') return cb(null, Object.keys(stored).map((id) => ({ id, value: stored[id] })));
      if (op === 'set') stored[opts.id] = opts.data.value;
      return cb(null);
    });
  });

  afterEach(() => {
    storageStub.restore();
  });

  it('creates and stores a key pair when there is none, then reuses it', (done) => {
    secure.generate_keys((err) => {
      expect(err).to.not.exist;
      const firstPublic = stored.public_key;
      expect(Buffer.from(firstPublic, 'base64').toString()).to.include('BEGIN PUBLIC KEY');
      secure.generate_keys((err2) => {
        expect(err2).to.not.exist;
        expect(stored.public_key).to.equal(firstPublic);
        expect(secure.public_keys().default).to.include('BEGIN PUBLIC KEY');
        done();
      });
    });
  });

  it('replaces an unreadable stored pair instead of throwing', (done) => {
    stored = { public_key: CORRUPT, private_key: CORRUPT };
    secure.generate_keys((err) => {
      expect(err).to.not.exist;
      expect(Buffer.from(stored.public_key, 'base64').toString()).to.include('BEGIN PUBLIC KEY');
      expect(Buffer.from(stored.private_key, 'base64').toString()).to.include('PRIVATE KEY');
      done();
    });
  });
});
