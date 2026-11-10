/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

// Simulates child_process.exec throwing synchronously, as it does for spawn
// failures outside Node's async allowlist (e.g. `spawn EROFS` when the inherited
// cwd is read-only/invalid during an upgrade).
const throwingExec = () => { throw new Error('spawn EROFS'); };

describe('Hardware Windows Provider', () => {
  let windowsProvider;

  beforeEach(() => {
    windowsProvider = rewire('../../../../../lib/agent/providers/hardware/windows');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('spawn EROFS resilience (synchronous throw)', () => {
    it('get_ram_module_list delivers the throw as a callback error, never throwing', (done) => {
      windowsProvider.__set__('exec', throwingExec);

      expect(() => {
        windowsProvider.get_ram_module_list((err) => {
          expect(err).to.be.an('error');
          expect(err.message).to.match(/EROFS/);
          done();
        });
      }).to.not.throw();
    });

    it('get_osquery_running reports not-running on the throw, never throwing', (done) => {
      windowsProvider.__set__('exec', throwingExec);

      expect(() => {
        windowsProvider.get_osquery_running((err, running, key) => {
          expect(err).to.be.null;
          expect(running).to.be.false;
          expect(key).to.equal('osquery_running');
          done();
        });
      }).to.not.throw();
    });
  });

  describe('safe cwd on spawned children', () => {
    it('get_ram_module_list passes a cwd option to exec', () => {
      const execStub = sinon.stub();
      windowsProvider.__set__('exec', execStub);

      windowsProvider.get_ram_module_list(() => {});

      expect(execStub.calledOnce).to.be.true;
      const opts = execStub.firstCall.args[1];
      expect(opts).to.be.an('object');
      expect(opts.cwd).to.be.a('string').and.not.be.empty;
    });

    it('get_osquery_running passes a cwd option to exec', () => {
      const execStub = sinon.stub();
      windowsProvider.__set__('exec', execStub);

      windowsProvider.get_osquery_running(() => {});

      expect(execStub.calledOnce).to.be.true;
      const opts = execStub.firstCall.args[1];
      expect(opts).to.be.an('object');
      expect(opts.cwd).to.be.a('string').and.not.be.empty;
    });
  });

  describe('get_firmware_info partial reads', () => {
    const sysOk = {
      uuid: 'b4c3177b-e461-4741-aa01-ddc1fb3b561d', serial: 'MBN0CV216329478', model: 'VivoBook', manufacturer: 'ASUSTeK',
    };
    const biosOk = { vendor: 'American Megatrends', version: 'X513EAN.307' };
    const boardOk = {
      manufacturer: 'ASUSTeK', serial: 'MB46NBCV00UNCCMB', model: 'X513EAN', version: '1.0',
    };
    // Each reader answers with the next queued result, repeating the last one.
    const readerFrom = (results) => {
      const stub = sinon.stub();
      results.forEach((res, i) => stub.onCall(i).callsFake((cb) => cb(res)));
      stub.callsFake((cb) => cb(results[results.length - 1]));
      return stub;
    };

    beforeEach(() => {
      windowsProvider.__set__('FIRMWARE_RETRY_DELAY', 0);
      windowsProvider.__set__('system', readerFrom([sysOk]));
      windowsProvider.__set__('battery', readerFrom([{ hasBattery: true }]));
    });

    it('still reads the baseboard when the BIOS read stays empty', (done) => {
      const biosStub = readerFrom([{ vendor: '' }]);
      windowsProvider.__set__('bios', biosStub);
      windowsProvider.__set__('baseboard', readerFrom([boardOk]));

      windowsProvider.get_firmware_info((err, data) => {
        expect(err).to.be.null;
        expect(biosStub.callCount).to.equal(3);
        expect(data).to.not.have.property('bios_vendor');
        expect(data.mb_serial).to.equal('MB46NBCV00UNCCMB');
        expect(data.device_type).to.equal('Laptop');
        done();
      });
    });

    it('retries an empty baseboard read and keeps the value once it answers', (done) => {
      const boardStub = readerFrom([{ manufacturer: '', serial: '-' }, boardOk]);
      windowsProvider.__set__('bios', readerFrom([biosOk]));
      windowsProvider.__set__('baseboard', boardStub);

      windowsProvider.get_firmware_info((err, data) => {
        expect(err).to.be.null;
        expect(boardStub.callCount).to.equal(2);
        expect(data.bios_vendor).to.equal('American Megatrends');
        expect(data.mb_serial).to.equal('MB46NBCV00UNCCMB');
        done();
      });
    });

    it('leaves board fields and device_type out when every read stays empty', (done) => {
      const batteryStub = readerFrom([{ hasBattery: false }]);
      windowsProvider.__set__('bios', readerFrom([null]));
      windowsProvider.__set__('baseboard', readerFrom([{ manufacturer: ' ' }]));
      windowsProvider.__set__('battery', batteryStub);

      windowsProvider.get_firmware_info((err, data) => {
        expect(err).to.be.null;
        expect(data).to.have.keys('uuid', 'serial_number', 'model_name', 'vendor_name');
        expect(data.uuid).to.equal('B4C3177B-E461-4741-AA01-DDC1FB3B561D');
        expect(batteryStub.called).to.be.false;
        done();
      });
    });

    it('leaves mb_serial out instead of null when the board has no serial', (done) => {
      windowsProvider.__set__('bios', readerFrom([biosOk]));
      windowsProvider.__set__('baseboard', readerFrom([{ ...boardOk, serial: '' }]));

      windowsProvider.get_firmware_info((err, data) => {
        expect(err).to.be.null;
        expect(data.mb_vendor).to.equal('ASUSTeK');
        expect(data).to.not.have.property('mb_serial');
        done();
      });
    });

    it('returns an error when the system read has no uuid', (done) => {
      windowsProvider.__set__('system', readerFrom([{ uuid: '' }]));

      windowsProvider.get_firmware_info((err) => {
        expect(err).to.be.an('error');
        done();
      });
    });
  });
});
