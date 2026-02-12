/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const hooks = require('../../../../lib/agent/hooks');
const common = require('../../../../lib/agent/common');

describe('Providers', () => {
  let providers;
  let hooksTriggerStub;
  let exceptionsSendStub;

  beforeEach(() => {
    // Stub hooks and exceptions before loading providers
    hooksTriggerStub = sinon.stub(hooks, 'trigger');
    exceptionsSendStub = sinon.stub(common.exceptions, 'send');

    // Clear providers cache to get fresh instance each test
    delete require.cache[require.resolve('../../../../lib/agent/providers')];
    providers = require('../../../../lib/agent/providers');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('get', () => {
    describe('when provider throws an exception', () => {
      it('should catch the error and not crash the process', (done) => {
        const throwingGetter = sinon.stub().throws(new Error('cb is not a function'));

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { failing_provider: throwingGetter });
        });

        // Called with 2 args (no callback), like commands.js does
        providers.get('failing_provider', { some: 'options' });

        // Should not crash, error goes to hooks
        setImmediate(() => {
          expect(hooksTriggerStub.calledWith('error')).to.be.true;
          const errorArg = hooksTriggerStub.getCalls()
            .find((c) => c.args[0] === 'error');
          expect(errorArg.args[1].message).to.equal('cb is not a function');
          done();
        });
      });

      it('should send the error to exceptions service', (done) => {
        const error = new Error('unexpected provider error');
        const throwingGetter = sinon.stub().throws(error);

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { failing_provider: throwingGetter });
        });

        providers.get('failing_provider', { some: 'options' });

        setImmediate(() => {
          expect(exceptionsSendStub.calledOnce).to.be.true;
          expect(exceptionsSendStub.calledWith(error)).to.be.true;
          done();
        });
      });

      it('should pass error to callback when one is provided', (done) => {
        const throwingGetter = sinon.stub().throws(new Error('provider crashed'));

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { failing_provider: throwingGetter });
        });

        // Called with callback as 2nd arg (no options)
        providers.get('failing_provider', (err) => {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.message).to.equal('provider crashed');
          done();
        });
      });
    });

    describe('when provider works correctly', () => {
      it('should emit data via hooks when called without callback', (done) => {
        const getter = sinon.stub().callsFake((opts, cb) => {
          cb(null, ['user1', 'user2']);
        });

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { users_list: getter });
        });

        providers.get('users_list', { depth: 1 });

        setImmediate(() => {
          expect(hooksTriggerStub.calledWith('data', 'users_list')).to.be.true;
          const dataCall = hooksTriggerStub.getCalls()
            .find((c) => c.args[0] === 'data');
          expect(dataCall.args[2]).to.deep.equal(['user1', 'user2']);
          done();
        });
      });

      it('should call provider without options when none provided', (done) => {
        const getter = sinon.stub().callsFake((cb) => {
          cb(null, ['user1', 'user2']);
        });

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { users_list: getter });
        });

        providers.get('users_list', (err, result) => {
          expect(err).to.be.null;
          expect(result).to.deep.equal(['user1', 'user2']);
          done();
        });
      });
    });
  });
});
