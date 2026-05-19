/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('utilinformation', () => {
  let utilinfo;
  let execStub;

  beforeEach(() => {
    utilinfo = rewire('../../../../lib/agent/utils/utilinformation');
    execStub = sinon.stub();
    utilinfo.__set__('exec', execStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getRemainingStorage', () => {
    it('should call exec with a timeout of 10000ms', () => {
      execStub.yields(null, 'Size : 107374182400\r\nFreeSpace : 53687091200\r\n');
      utilinfo.getRemainingStorage(() => {});
      expect(execStub.calledOnce).to.be.true;
      const opts = execStub.firstCall.args[1];
      expect(opts).to.be.an('object');
      expect(opts.timeout).to.equal(10000);
    });

    it('should pass exec errors to the callback', (done) => {
      const execError = new Error('PowerShell timeout');
      execStub.yields(execError, null);
      utilinfo.getRemainingStorage((err) => {
        expect(err).to.equal(execError);
        done();
      });
    });

    it('should pass stdout to the callback on success', (done) => {
      const output = 'Size : 107374182400\r\nFreeSpace : 53687091200\r\n';
      execStub.yields(null, output);
      utilinfo.getRemainingStorage((err, stdout) => {
        expect(err).to.be.null;
        expect(stdout).to.equal(output);
        done();
      });
    });
  });
});
