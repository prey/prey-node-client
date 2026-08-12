/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const storage = require('../../../../lib/agent/utils/storage');
const storeIdentification = require('../../../../lib/agent/control-panel/store-identification');

describe('storeIdentification.save', () => {
  let storageDoStub;

  beforeEach(() => {
    storageDoStub = sinon.stub(storage, 'do');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('calls callback with error when key is empty', (done) => {
    storeIdentification.save('', { os: 'linux' }, (err) => {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('No device key');
      expect(storageDoStub.called).to.be.false;
      done();
    });
  });

  it('calls callback with error when key is null', (done) => {
    storeIdentification.save(null, { os: 'linux' }, (err) => {
      expect(err).to.be.instanceOf(Error);
      expect(storageDoStub.called).to.be.false;
      done();
    });
  });

  it('calls storage.set when the row does not exist in the db', (done) => {
    storageDoStub.withArgs('query').callsFake((_op, _opts, cb) => cb(null, []));
    storageDoStub.withArgs('set').callsFake((_op, _opts, cb) => cb(null));

    const payload = { name: 'MyDevice', os: 'windows' };
    storeIdentification.save('abc-key-123', payload, (err) => {
      expect(err).to.be.null;

      const setCall = storageDoStub.getCalls().find((c) => c.args[0] === 'set');
      expect(setCall).to.exist;
      expect(setCall.args[1].type).to.equal('keys');
      expect(setCall.args[1].id).to.equal('deviceIdentificationData');

      const parsed = JSON.parse(setCall.args[1].data.value);
      expect(parsed.device_key).to.equal('abc-key-123');
      expect(parsed.payload.name).to.equal('MyDevice');
      expect(parsed).to.have.property('created_at');
      done();
    });
  });

  it('calls storage.update when the row already exists in the db', (done) => {
    storageDoStub.withArgs('query').callsFake((_op, _opts, cb) => cb(null, [{ id: 'deviceIdentificationData', value: '{}' }]));
    storageDoStub.withArgs('update').callsFake((_op, _opts, cb) => cb(null));

    const payload = { name: 'MyDevice', os: 'mac' };
    storeIdentification.save('abc-key-123', payload, (err) => {
      expect(err).to.be.null;

      const updateCall = storageDoStub.getCalls().find((c) => c.args[0] === 'update');
      expect(updateCall).to.exist;
      expect(updateCall.args[1].type).to.equal('keys');
      expect(updateCall.args[1].id).to.equal('deviceIdentificationData');
      expect(updateCall.args[1].columns).to.equal('value');

      const parsed = JSON.parse(updateCall.args[1].values);
      expect(parsed.device_key).to.equal('abc-key-123');
      expect(parsed.payload.os).to.equal('mac');
      done();
    });
  });

  it('removes single quotes from the stored value', (done) => {
    storageDoStub.withArgs('query').callsFake((_op, _opts, cb) => cb(null, []));
    storageDoStub.withArgs('set').callsFake((_op, _opts, cb) => cb(null));

    const payload = { name: "John's Mac", os: 'darwin' };
    storeIdentification.save('abc-key-123', payload, () => {
      const setCall = storageDoStub.getCalls().find((c) => c.args[0] === 'set');
      expect(setCall.args[1].data.value).to.not.include("'");
      done();
    });
  });

  it('propagates the query error to the callback', (done) => {
    storageDoStub.withArgs('query').callsFake((_op, _opts, cb) => cb(new Error('DB error'), null));

    storeIdentification.save('abc-key-123', {}, (err) => {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('DB error');
      done();
    });
  });

  it('works without a callback (best-effort, no throw)', () => {
    storageDoStub.withArgs('query').callsFake((_op, _opts, cb) => cb(null, []));
    storageDoStub.withArgs('set').callsFake((_op, _opts, cb) => cb(null));

    expect(() => storeIdentification.save('abc-key-123', {})).to.not.throw();
  });
});
