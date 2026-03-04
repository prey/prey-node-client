/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const fs = require('fs');

describe('mac os hooks', () => {
  let macRewired;
  let readFileStub;
  let execStub;
  let processKillStub;
  let findAndKill;

  beforeEach(() => {
    macRewired = rewire('../../../../../lib/conf/tasks/os/mac');

    readFileStub = sinon.stub(fs, 'readFile');
    execStub = sinon.stub();
    processKillStub = sinon.stub(process, 'kill');

    macRewired.__set__('exec', execStub);
    macRewired.__set__('common', { version: '1.13.27' });

    findAndKill = macRewired.__get__('find_and_kill');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should skip killing prx when latest prey.log version matches installing version', (done) => {
    readFileStub.callsFake((path, enc, cb) => {
      const content = [
        'some line',
        'PREY 1.13.20 spreads its wings!',
        'PREY 1.13.27 spreads its wings!',
      ].join('\n');
      cb(null, content);
    });

    findAndKill('1.13.25', 99999, () => {
      expect(execStub.called).to.equal(false);
      expect(processKillStub.called).to.equal(false);
      done();
    });
  });

  it('should kill matching prx processes when latest prey.log version differs from installing version', (done) => {
    readFileStub.callsFake((path, enc, cb) => {
      cb(null, 'PREY 1.13.25 spreads its wings!');
    });

    execStub.callsFake((cmd, cb) => {
      const psOutput = [
        '  300 prx --self',
        '  111 prx --daemon',
        '  112 /usr/local/lib/prey/current/bin/prx --daemon',
        '  113 /usr/bin/node something-else',
      ].join('\n');
      cb(null, psOutput);
    });

    processKillStub.callsFake((pid, signal) => {
      if (signal === 'SIGKILL') return;
      if (signal === 0) {
        const err = new Error('ESRCH');
        err.code = 'ESRCH';
        throw err;
      }
    });

    findAndKill('1.13.25', 300, () => {
      expect(execStub.calledOnce).to.equal(true);
      expect(processKillStub.calledWith(111, 'SIGKILL')).to.equal(true);
      expect(processKillStub.calledWith(112, 'SIGKILL')).to.equal(true);
      expect(processKillStub.calledWith(300, 'SIGKILL')).to.equal(false);
      done();
    });
  });

  it('should proceed to kill when no wings line exists in the last 200 log lines', (done) => {
    readFileStub.callsFake((path, enc, cb) => {
      cb(null, Array.from({ length: 220 }, (_, i) => `line ${i + 1}`).join('\n'));
    });

    execStub.callsFake((cmd, cb) => {
      cb(null, '  211 prx --daemon\n  212 /usr/bin/node');
    });

    processKillStub.callsFake((pid, signal) => {
      if (signal === 'SIGKILL') return;
      if (signal === 0) {
        const err = new Error('ESRCH');
        err.code = 'ESRCH';
        throw err;
      }
    });

    findAndKill('1.13.25', 300, () => {
      expect(execStub.calledOnce).to.equal(true);
      expect(processKillStub.calledWith(211, 'SIGKILL')).to.equal(true);
      done();
    });
  });
});
