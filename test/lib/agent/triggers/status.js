const assert = require('assert');

const mocha = require('mocha');

const { describe } = mocha;
const { it } = mocha;
const { beforeEach } = mocha;
const sinon = require('sinon');
// eslint-disable-next-line camelcase
const triggers_status = require('../../../../lib/agent/triggers/status');
const { get_status } = require('../../../../lib/agent/triggers/status');

describe('get_status', () => {
  beforeEach(() => {
    sinon.restore();
  });

  it('should return the last checked status if status is truthy', (done) => {
    const status = 'ready';
    const cb = (err, result) => {
      assert.strictEqual(result, status);
      done();
    };
    sinon.stub(triggers_status, 'status').value(status);
    get_status(cb);
  });

  it('should not call status_info if status', () => {
    const status = 'ready';
    sinon.stub(triggers_status, 'status').value(status);
    // eslint-disable-next-line camelcase
    const status_info = sinon.spy(triggers_status, 'status_info');
    get_status(() => {});
    sinon.assert.notCalled(status_info);
  });

  it('should return null if statusCallbacks.length is greater than 5', (done) => {
    const cb = (err, result) => {
      assert.strictEqual(result, null);
      done();
    };
    const statusCallbacks = [1, 2, 3, 4, 5, 6];
    sinon.stub(triggers_status, 'statusCallbacks').value(statusCallbacks);
    get_status(cb);
  });

  it('should push callback to statusCallbacks', () => {
    const cb = () => {};
    const statusCallbacks = [];
    sinon.stub(triggers_status, 'statusCallbacks').value(statusCallbacks);
    get_status(cb);
    assert.deepStrictEqual(statusCallbacks, [cb]);
  });

  it('should call status_info and return status if status is falsy at first', (done) => {
    sinon.stub(triggers_status, 'timeoutGetStatusMs').value(500);
    const statusInfo = { foo: 'bar' };
    const cb = (err, result) => {
      assert.deepStrictEqual(result, statusInfo);
      done();
    };
    sinon.stub(triggers_status, 'status').value(null);
    sinon.stub(triggers_status, 'status_info').callsFake((cbStatusInfo) => cbStatusInfo(null, statusInfo));
    get_status(cb);
  });

  it('should call all callbacks in statusCallbacks and clear statusCallbacks', () => {
    const cb1 = sinon.stub();
    const cb2 = sinon.stub();
    const statusCallbacks = [cb1, cb2];
    const statusInfo = { foo: 'bar' };
    sinon.stub(triggers_status, 'status_info').callsFake((cbStatusInfo) => cbStatusInfo(null, statusInfo));
    sinon.stub(triggers_status, 'status').value(null);
    sinon.stub(triggers_status, 'statusCallbacks').value(statusCallbacks);
    get_status(() => {});
    sinon.assert.calledWith(cb1, null);
    sinon.assert.calledWith(cb2, null);
    // eslint-disable-next-line camelcase
    assert.equal(triggers_status.statusCallbacks.length, ([]).length);
  });
});
