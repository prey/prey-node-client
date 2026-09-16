/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');

describe('Providers', () => {
  let providers;
  let hooks;
  let common;
  let hooksTriggerStub;
  let exceptionsSendStub;

  beforeEach(() => {
    // Reload shared modules so stubs target the same instances used by providers.
    delete require.cache[require.resolve('../../../../lib/agent/hooks')];
    delete require.cache[require.resolve('../../../../lib/agent/common')];

    // Clear providers cache to get fresh instance each test
    delete require.cache[require.resolve('../../../../lib/agent/providers')];

    hooks = require('../../../../lib/agent/hooks');
    common = require('../../../../lib/agent/common');
    hooksTriggerStub = sinon.stub(hooks, 'trigger');
    exceptionsSendStub = sinon.stub(common.exceptions, 'send');
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

      it('should invoke the callback when called with (name, options, cb)', (done) => {
        const getter = sinon.stub().callsFake((opts, cb) => {
          cb(null, { ok: true });
        });

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { battery_status: getter });
        });

        // 3-argument form used by e.g. the power trigger:
        // providers.get('battery_status', { bypassCache: true }, cb)
        providers.get('battery_status', { bypassCache: true }, (err, result) => {
          expect(err).to.be.null;
          expect(result).to.deep.equal({ ok: true });
          expect(getter.firstCall.args[0]).to.deep.equal({ bypassCache: true });
          done();
        });
      });
    });

    describe('when the same provider is requested concurrently', () => {
      it('should run the getter once and resolve every queued callback', (done) => {
        // Getter that defers resolution so both get() calls overlap in-flight.
        let internalCb;
        const getter = sinon.stub().callsFake((cb) => {
          internalCb = cb;
        });

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { battery_status: getter });
        });

        const results = [];
        const collect = (err, result) => results.push({ err, result });

        // Two overlapping requests for the same provider. The second must be
        // coalesced onto the first rather than triggering a second getter run.
        providers.get('battery_status', collect);
        providers.get('battery_status', collect);

        expect(getter.callCount).to.equal(1);

        // Resolve the single in-flight getter; both callbacks should fire.
        internalCb(null, { percentage_remaining: 80 });

        setImmediate(() => {
          expect(results).to.have.lengthOf(2);
          results.forEach(({ err, result }) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal({ percentage_remaining: 80 });
          });
          expect(getter.callCount).to.equal(1);
          done();
        });
      });

      it('does not coalesce a bypassCache request onto an in-flight cached fetch', (done) => {
        const optsSeen = [];
        let firstCb;
        const getter = sinon.stub().callsFake((optsOrCb, maybeCb) => {
          const isFn = typeof optsOrCb === 'function';
          optsSeen.push(isFn ? undefined : optsOrCb);
          const cb = isFn ? optsOrCb : maybeCb;
          if (!firstCb) firstCb = cb; // first request stays in-flight
          else cb(null, 'FRESH'); // the bypass request resolves fresh
        });

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { battery_status: getter });
        });

        let resBypass;
        // Non-bypass request goes in-flight (getter defers its callback).
        providers.get('battery_status', {}, () => {});
        // Bypass request must NOT be coalesced onto the in-flight fetch.
        providers.get('battery_status', { bypassCache: true }, (err, result) => {
          resBypass = result;
        });

        expect(getter.callCount).to.equal(2);
        expect(resBypass).to.equal('FRESH');
        done();
      });
    });

    describe('re-entrancy safety', () => {
      it('re-entrant get() during a callback neither drops nor duplicates callbacks', (done) => {
        let internalCb;
        const getter = sinon.stub().callsFake((cb) => {
          // First run defers; the re-entrant run resolves synchronously.
          if (!internalCb) internalCb = cb;
          else cb(null, 'SECOND');
        });

        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { some_provider: getter });
        });

        const aCalls = [];
        const bCalls = [];
        let reentered = false;

        const cbA = (err, result) => {
          aCalls.push(result);
          // Re-enter synchronously from within the callback exactly once.
          if (!reentered) {
            reentered = true;
            providers.get('some_provider', (e, r) => aCalls.push(`reentrant:${r}`));
          }
        };
        const cbB = (err, result) => bCalls.push(result);

        // Two callbacks queued on the same in-flight getter.
        providers.get('some_provider', cbA);
        providers.get('some_provider', cbB);

        // Resolve the first in-flight run: fires cbA (which re-enters) and cbB.
        expect(() => internalCb(null, 'FIRST')).to.not.throw();

        setImmediate(() => {
          // cbA fired once for FIRST, cbB fired once for FIRST — no loss, no dup.
          expect(aCalls).to.include('FIRST');
          expect(bCalls).to.deep.equal(['FIRST']);
          // The re-entrant request ran its own fresh getter and resolved.
          expect(aCalls).to.include('reentrant:SECOND');
          done();
        });
      });
    });

    // End-to-end through the REAL indicators adapter (only os_functions is stubbed,
    // at the platform boundary). This is the path the power trigger actually takes;
    // stubbing providers.get or providers.map with a fake getter — as the other
    // tests do — would not catch a signature mismatch in the indicators wrapper.
    describe('bypassCache through the real indicators.get_battery_status adapter', () => {
      // eslint-disable-next-line global-require
      const rewire = require('rewire');

      it('resolves the callback once with fresh data and forwards bypassCache to the platform getter', (done) => {
        const data = { percentage_remaining: 42, state: 'discharging' };
        const indicators = rewire('../../../../lib/agent/providers/indicators/index');
        const osFunctions = { get_battery_status: sinon.stub().callsFake((opts, cb) => cb(null, data)) };
        indicators.__set__('os_functions', osFunctions);

        // providers.map only does file discovery; wire the real adapter as the getter.
        sinon.stub(providers, 'map').callsFake((cb) => {
          cb(null, { battery_status: indicators.get_battery_status });
        });

        const callback = sinon.stub();

        expect(() => providers.get('battery_status', { bypassCache: true }, callback)).to.not.throw();

        setImmediate(() => {
          expect(callback.callCount).to.equal(1);
          expect(callback.firstCall.args[0]).to.be.null;
          expect(callback.firstCall.args[1]).to.deep.equal(data);
          // The options object must reach the platform getter, not be swallowed as a cb.
          expect(osFunctions.get_battery_status.callCount).to.equal(1);
          expect(osFunctions.get_battery_status.firstCall.args[0]).to.deep.equal({ bypassCache: true });
          done();
        });
      });
    });
  });
});
