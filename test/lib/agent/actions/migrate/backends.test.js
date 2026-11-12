/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const { join } = require('path');

describe('migrate backends', () => {
  afterEach(() => sinon.restore());

  describe('windows', () => {
    let backend;
    let winsvc;

    beforeEach(() => {
      backend = rewire('../../../../../lib/agent/actions/migrate/windows');
      winsvc = { supports: sinon.stub(), request_action: sinon.stub() };
      backend.__set__('winsvc', winsvc);
    });

    it('requires winsvc 2.0.37', (done) => {
      winsvc.supports.callsFake((min, cb) => cb(false));
      backend.checkService((token) => {
        expect(winsvc.supports.firstCall.args[0]).to.equal('2.0.37');
        expect(token).to.equal('winsvc_too_old');
        done();
      });
    });

    it('submits migrate with 240 s and unwraps output', (done) => {
      winsvc.request_action.callsFake((action, ms, cb) => cb(null, { error: false, output: { error: true, message: 'rate_limited' } }));
      backend.submit((err, result) => {
        expect(winsvc.request_action.firstCall.args.slice(0, 2)).to.deep.equal(['migrate', 240000]);
        expect(err).to.equal(null);
        expect(result).to.deep.equal({ error: true, message: 'rate_limited' });
        done();
      });
    });

    it('reads migrate-status with 60 s and rejects a failed envelope', (done) => {
      winsvc.request_action.callsFake((action, ms, cb) => cb(null, { error: true, output: 'boom' }));
      backend.status((err) => {
        expect(winsvc.request_action.firstCall.args.slice(0, 2)).to.deep.equal(['migrate-status', 60000]);
        expect(err.message).to.equal('service_error');
        done();
      });
    });

    it('passes a transport timeout through', (done) => {
      winsvc.request_action.callsFake((action, ms, cb) => cb(new Error('timeout')));
      backend.submit((err) => {
        expect(err.message).to.equal('timeout');
        done();
      });
    });

    it('detects goprey by its remsvc service', (done) => {
      const execFile = sinon.stub().callsFake((bin, args, opts, cb) => cb(null));
      backend.__set__('execFile', execFile);
      const systemRoot = process.env.SystemRoot;
      process.env.SystemRoot = String.raw`D:\Win`;
      backend.gopreyInstalled((installed) => {
        if (systemRoot === undefined) delete process.env.SystemRoot;
        else process.env.SystemRoot = systemRoot;
        expect(execFile.firstCall.args[0]).to.equal(join(String.raw`D:\Win`, 'System32', 'sc.exe'));
        expect(execFile.firstCall.args[1]).to.deep.equal(['query', 'remsvc']);
        expect(installed).to.equal(true);
        done();
      });
    });
  });

  describe('mac', () => {
    let backend;
    let socket;

    beforeEach(() => {
      backend = rewire('../../../../../lib/agent/actions/migrate/mac');
      socket = { request: sinon.stub() };
      backend.__set__('socket', socket);
    });

    it('requires macsvc 1.1.0', (done) => {
      backend.__set__('getPreyUserVersion', (cb) => cb(null, '1.0.11'));
      backend.checkService((token) => {
        expect(token).to.equal('macsvc_too_old');
        backend.__set__('getPreyUserVersion', (cb) => cb(null, '1.1.0'));
        backend.checkService((token2) => {
          expect(token2).to.equal(null);
          done();
        });
      });
    });

    it('calls back once, deferred, even when the callback throws', () => {
      // get_prey_user_version calls back inside a try and calls back again from its catch.
      backend.__set__('getPreyUserVersion', (cb) => {
        try {
          cb(null, '1.1.0');
        } catch (e) {
          cb(e);
        }
      });
      const deferred = [];
      backend.__set__('setImmediate', (fn) => deferred.push(fn));
      const cb = sinon.stub().throws(new Error('downstream'));
      backend.checkService(cb);
      expect(cb.called).to.equal(false);
      expect(deferred.length).to.equal(1);
      expect(() => deferred[0]()).to.throw('downstream');
      expect(cb.calledOnce).to.equal(true);
      expect(cb.firstCall.args[0]).to.equal(null);
    });

    it('treats an unreadable macsvc version as too old', (done) => {
      backend.__set__('getPreyUserVersion', (cb) => cb(new Error('missing')));
      backend.checkService((token) => {
        expect(token).to.equal('macsvc_too_old');
        done();
      });
    });

    it('submits on its own connection with 270 s and unwraps output.result', (done) => {
      socket.request.callsFake((name, ms, cb) => cb(null, {
        name: 'migrate', function: 'migrate', success: true, output: { result: { error: false, operation: { id: 'a', phase: 'admitted' } } },
      }));
      backend.submit((err, result) => {
        expect(socket.request.firstCall.args.slice(0, 2)).to.deep.equal(['migrate-migrate', 270000]);
        expect(result.operation.id).to.equal('a');
        done();
      });
    });

    it('rejects an unsuccessful envelope from status', (done) => {
      socket.request.callsFake((name, ms, cb) => cb(null, {
        name: 'migrate', function: 'status', success: false, output: { error: 'x' },
      }));
      backend.status((err) => {
        expect(socket.request.firstCall.args.slice(0, 2)).to.deep.equal(['migrate-status', 90000]);
        expect(err.message).to.equal('service_error');
        done();
      });
    });

    it('detects goprey by its pkg receipt', (done) => {
      const execFile = sinon.stub().callsFake((bin, args, opts, cb) => cb(new Error('no receipt')));
      backend.__set__('execFile', execFile);
      backend.gopreyInstalled((installed) => {
        expect(execFile.firstCall.args[0]).to.equal('/usr/sbin/pkgutil');
        expect(execFile.firstCall.args[1]).to.deep.equal(['--pkg-info', 'com.preyhq.prey.agent']);
        expect(installed).to.equal(false);
        done();
      });
    });
  });
});
