/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const os = require('node:os');
const sinon = require('sinon');
const { expect } = require('chai');
const exp = require('../../../../../lib/agent/providers/hardware');
const hooksModule = require('../../../../../lib/agent/hooks');
const utilStorage = require('../../../../../lib/agent/utils/storage/utilstorage');

describe('Hardware_Provider', () => {
  let deleteDbKeyStub;
  let getDataDbKeyStub;
  let saveDataDbKeyStub;
  let updateDataDbKeyStub;
  let storedComparisonDataHardwareChangedStub;
  const hardware1 = {
    processor_info: { model: 'AMD Ryzen 7 5700X 8-Core Processor', speed: 3394, cores: 16 },
    ram_module_list: [{
      name: 'Physical Memory', bank: 'BANK 0', location: 'DIMM_A1', size: 8192, form_factor: 'DIMM', memory_type: 'Unknown', speed: 2666, data_width: 64,
    }],
    winsvc_version: '2.0.25',
    osquery_running: false,
    killswitch_compatible: true,
    rp_module: { available: true },
    os_edition: 'Pro',
    network_interfaces_list: [{
      name: 'Ethernet', mac_address: 'c8:7f:54:c6:30:a6', model: 'Realtek PCIe 2.5GbE Family Controller', type: 'Wired', netmask: '255.255.255.0', gateway_ip: null, ip_address: '192.168.1.93', vendor: { type: 'Buffer', data: [82, 101, 97, 108, 116, 101, 107, 13, 10] },
    }],
    vendor_name: 'ASUS',
    model_name: 'System Product Name',
    firmware_info: {
      uuid: 'B7E2BE0D-3FD8-3845-F8F5-C87F54C630A6', serial_number: 'System Serial Number', model_name: 'System Product Name', vendor_name: 'ASUS', bios_vendor: 'American Megatrends Inc.', bios_version: '3002', mb_vendor: 'ASUSTeK COMPUTER INC.', mb_serial: '230418668704502', mb_model: 'TUF GAMING B550M-PLUS WIFI II', mb_version: 'Rev X.0x', device_type: 'Desktop',
    },
    tpm_module: {
      available: true, active: true, manufacturer: 'AMD', manufacturer_version: '3.87.0.5',
    },
  };

  const hardware2 = {
    processor_info: { model: 'AMD Ryzen 7 5700X 8-Core Processor', speed: 3394, cores: 16 },
    ram_module_list: [{
      name: 'Physical Memory', bank: 'BANK 0', location: 'DIMM_A1', size: 8192, form_factor: 'DIMM', memory_type: 'Unknown', speed: 2666, data_width: 64,
    }],
    winsvc_version: '2.0.26',
    osquery_running: true,
    killswitch_compatible: true,
    rp_module: { available: true },
    os_edition: 'Pro',
    network_interfaces_list: [{
      name: 'Ethernet', mac_address: 'c8:7f:54:c6:30:a6', model: 'Realtek PCIe 2.5GbE Family Controller', type: 'Wired', netmask: '255.255.255.0', gateway_ip: null, ip_address: '192.168.1.93', vendor: { type: 'Buffer', data: [82, 101, 97, 108, 116, 101, 107, 13, 10] },
    }],
    vendor_name: 'ASUS',
    model_name: 'System Product Name',
    firmware_info: {
      uuid: 'B7E2BE0D-3FD8-3845-F8F5-C87F54C630A6', serial_number: 'System Serial Number', model_name: 'System Product Name', vendor_name: 'ASUS', bios_vendor: 'American Megatrends Inc.', bios_version: '3002', mb_vendor: 'ASUSTeK COMPUTER INC.', mb_serial: '230418668704502', mb_model: 'TUF GAMING B550M-PLUS WIFI II', mb_version: 'Rev X.0x', device_type: 'Desktop',
    },
    tpm_module: {
      available: true, active: true, manufacturer: 'AMD', manufacturer_version: '3.87.0.5',
    },
  };

  beforeEach(() => {
    exp.diffCount = 0;
    getDataDbKeyStub = sinon.stub(utilStorage, 'getDataDbKey');
    saveDataDbKeyStub = sinon.stub(utilStorage, 'saveDataDbKey');
    updateDataDbKeyStub = sinon.stub(utilStorage, 'updateDataDbKey');
    deleteDbKeyStub = sinon.stub(utilStorage, 'deleteDbKey');
  });

  afterEach(() => {
    getDataDbKeyStub.restore();
    saveDataDbKeyStub.restore();
    updateDataDbKeyStub.restore();
    deleteDbKeyStub.restore();
    if (storedComparisonDataHardwareChangedStub) storedComparisonDataHardwareChangedStub.restore();
  });

  describe('track_hardware_changes', () => {
    it('should track hardware changes correctly', (done) => {
      storedComparisonDataHardwareChangedStub = sinon.stub(exp, 'storedComparisonDataHardwareChanged');
      // Create a hardware version with detectable differences (not excluded)
      const storedHardware = JSON.parse(JSON.stringify(hardware1));
      storedHardware.vendor_name = 'DIFFERENT_VENDOR'; // This property is not in exclusionList

      getDataDbKeyStub.callsFake((method, cb) => {
        if (method === 'hardware_changed') {
          // Return error so it doesn't return early
          cb(new Error('not found'), null);
        } else if (method === 'hardware') {
          // Return different existing data to compare
          cb(null, [{ value: JSON.stringify(storedHardware) }]);
        }
      });
      saveDataDbKeyStub.callsFake((_method, _arg2, _arg3, cb) => {
        cb(null);
      });
      updateDataDbKeyStub.callsFake((_method, _arg2, _arg3, _arg4, cb) => {
        cb(null);
      });
      deleteDbKeyStub.callsFake((_method, cb) => {
        cb(null);
      });
      storedComparisonDataHardwareChangedStub.callsFake((_stored, _dataTrack, cb) => {
        cb(null, hardware1);
      });
      exp.track_hardware_changes(hardware1);

      setTimeout(() => {
        // getDataDbKey is called at least 2 times (hardware_changed and hardware)
        // and may be called more times from updateDataHardwareChanged
        expect(getDataDbKeyStub.called).to.be.true;
        expect(exp.diffCount).to.be.greaterThan(0);
        expect(deleteDbKeyStub.called).to.be.true;
        expect(saveDataDbKeyStub.called).to.be.true;
        done();
      }, 500);
    });
  });

  describe('compareSubField', () => {
    it('should compare subfields correctly', (done) => {
      exp.compareField(hardware1.processor_info, hardware2.processor_info);
      setTimeout(() => {
        expect(exp.diffCount).to.be.equal(0);
        done();
      }, 500);
    });
  });

  describe('compareField', () => {
    it('should compare fields correctly', (done) => {
      exp.compareField(hardware1.winsvc_version, hardware2.winsvc_version);
      expect(exp.diffCount).to.be.equal(1);
      done();
    });
  });

  describe('get_processor_info', () => {
    let cpusStub;

    afterEach(() => {
      if (cpusStub) {
        cpusStub.restore();
        cpusStub = null;
      }
    });

    it('should return correct info with valid cpu data', (done) => {
      cpusStub = sinon.stub(os, 'cpus').returns([
        { model: '  Intel Core i7  ', speed: 2400, times: {} },
        { model: '  Intel Core i7  ', speed: 2400, times: {} },
      ]);
      exp.get_processor_info((err, info) => {
        expect(err).to.be.null;
        expect(info).to.deep.equal({ model: 'Intel Core i7', speed: 2400, cores: 2 });
        done();
      });
    });

    it('should return defaults when os.cpus() returns empty array', (done) => {
      cpusStub = sinon.stub(os, 'cpus').returns([]);
      exp.get_processor_info((err, info) => {
        expect(err).to.be.null;
        expect(info).to.deep.equal({ model: '', speed: 0, cores: 0 });
        done();
      });
    });

    it('should return defaults when os.cpus() returns null', (done) => {
      cpusStub = sinon.stub(os, 'cpus').returns(null);
      exp.get_processor_info((err, info) => {
        expect(err).to.be.null;
        expect(info).to.deep.equal({ model: '', speed: 0, cores: 0 });
        done();
      });
    });

    it('should return empty model when cpus[0].model is undefined', (done) => {
      cpusStub = sinon.stub(os, 'cpus').returns([{ model: undefined, speed: 3000, times: {} }]);
      exp.get_processor_info((err, info) => {
        expect(err).to.be.null;
        expect(info.model).to.equal('');
        expect(info.speed).to.equal(3000);
        done();
      });
    });

    it('should return 0 speed when cpus[0].speed is undefined', (done) => {
      cpusStub = sinon.stub(os, 'cpus').returns([{ model: 'Intel Core i5', speed: undefined, times: {} }]);
      exp.get_processor_info((err, info) => {
        expect(err).to.be.null;
        expect(info.model).to.equal('Intel Core i5');
        expect(info.speed).to.equal(0);
        done();
      });
    });
  });
});

describe('Hardware_Provider - network interface getters (OWCA-633)', () => {
  const rewire = require('rewire');
  const throwSystemError = () => {
    const err = new Error('A system error occurred: uv_interface_addresses returned Unknown system error 2');
    err.code = 'ERR_SYSTEM_ERROR';
    throw err;
  };
  let hardware;

  beforeEach(() => {
    hardware = rewire('../../../../../lib/agent/providers/hardware');
    hardware.__set__('network', { get_interfaces_list: throwSystemError });
  });

  it('get_network_interfaces_list turns a throw into a not-fatal callback error', (done) => {
    expect(() => hardware.get_network_interfaces_list((err, list) => {
      expect(err).to.be.an('error');
      expect(err.level).to.equal('not fatal');
      expect(list).to.be.undefined;
      done();
    })).to.not.throw();
  });

  it('get_first_mac_address turns a throw into a not-fatal callback error', (done) => {
    hardware.get_first_mac_address((err) => {
      expect(err).to.be.an('error');
      expect(err.level).to.equal('not fatal');
      done();
    });
  });

  it('get_network_interfaces_list forwards the list on success', (done) => {
    const list = [{ name: 'Ethernet', mac_address: 'aa:bb:cc:dd:ee:ff' }];
    hardware.__set__('network', { get_interfaces_list: (cb) => cb(null, list) });
    hardware.get_network_interfaces_list((err, result) => {
      expect(err).to.be.null;
      expect(result).to.equal(list);
      done();
    });
  });
});

describe('Hardware_Provider - partial firmware reads', () => {
  const hooks = hooksModule;
  const completeFirmware = {
    uuid: 'B4C3177B-E461-4741-AA01-DDC1FB3B561D',
    serial_number: 'MBN0CV216329478',
    model_name: 'VivoBook_ASUSLaptop X513EAN_K513EA',
    vendor_name: 'ASUSTeK COMPUTER INC.',
    bios_vendor: 'American Megatrends International, LLC.',
    bios_version: 'X513EAN.307',
    mb_vendor: 'ASUSTeK COMPUTER INC.',
    mb_serial: 'MB46NBCV00UNCCMB',
    mb_model: 'X513EAN',
    mb_version: '1.0',
    device_type: 'Laptop',
  };
  // What the agent stored on 2026-10-28 when the BIOS read came back empty.
  const partialFirmware = {
    uuid: completeFirmware.uuid,
    serial_number: completeFirmware.serial_number,
    model_name: completeFirmware.model_name,
    vendor_name: completeFirmware.vendor_name,
  };
  const specsWith = (firmware) => ({
    processor_info: { model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz', speed: 2803, cores: 8 },
    winsvc_version: '2.0.35',
    vendor_name: 'ASUSTeK COMPUTER INC.',
    model_name: 'VivoBook_ASUSLaptop X513EAN_K513EA',
    firmware_info: { ...firmware },
  });
  const savedBaseline = (stub) => JSON.parse(stub.lastCall.args[2]);
  let getDataDbKeyStub;
  let saveDataDbKeyStub;
  let triggerStub;

  // Serves `stored` as the 'hardware' key; 'hardware_changed' history already exists.
  const storeHardware = (stored) => {
    getDataDbKeyStub.callsFake((key, cb) => {
      if (key === 'hardware') return cb(null, stored ? [{ value: JSON.stringify(stored) }] : []);
      return cb(null, [{ value: JSON.stringify({ hardwareData: [] }) }]);
    });
  };

  beforeEach(() => {
    exp.diffCount = 0;
    getDataDbKeyStub = sinon.stub(utilStorage, 'getDataDbKey');
    saveDataDbKeyStub = sinon.stub(utilStorage, 'saveDataDbKey').callsFake((_t, _k, _v, cb) => cb(null));
    sinon.stub(utilStorage, 'updateDataDbKey').callsFake((_t, _k, _c, _v, cb) => cb(null));
    sinon.stub(utilStorage, 'deleteDbKey').callsFake((_k, cb) => cb(null));
    triggerStub = sinon.stub(hooks, 'trigger');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('fillFirmwareFromStored', () => {
    it('fills fields the read missed from the stored snapshot of the same machine', (done) => {
      storeHardware(specsWith(completeFirmware));
      exp.fillFirmwareFromStored({ ...partialFirmware, mb_serial: null }, (filled) => {
        expect(filled).to.deep.equal(completeFirmware);
        done();
      });
    });

    it('never overwrites a value that was actually read', (done) => {
      storeHardware(specsWith(completeFirmware));
      exp.fillFirmwareFromStored({ ...partialFirmware, mb_serial: 'NEWBOARD123' }, (filled) => {
        expect(filled.mb_serial).to.equal('NEWBOARD123');
        expect(filled.bios_vendor).to.equal(completeFirmware.bios_vendor);
        done();
      });
    });

    it('keeps a firmware filler string that was read instead of the stored value', (done) => {
      storeHardware(specsWith(completeFirmware));
      exp.fillFirmwareFromStored({ ...completeFirmware, serial_number: 'To be filled by O.E.M.' }, (filled) => {
        expect(filled.serial_number).to.equal('To be filled by O.E.M.');
        done();
      });
    });

    it('does not fill when the stored snapshot belongs to another uuid', (done) => {
      storeHardware(specsWith({ ...completeFirmware, uuid: 'OTHER-UUID' }));
      exp.fillFirmwareFromStored({ ...partialFirmware }, (filled) => {
        expect(filled).to.deep.equal(partialFirmware);
        done();
      });
    });

    it('passes the read through when there is no stored snapshot or the DB fails', (done) => {
      storeHardware(null);
      exp.fillFirmwareFromStored({ ...partialFirmware }, (first) => {
        expect(first).to.deep.equal(partialFirmware);
        getDataDbKeyStub.callsFake((_key, cb) => cb(new Error('SQLITE_BUSY')));
        exp.fillFirmwareFromStored({ ...partialFirmware }, (second) => {
          expect(second).to.deep.equal(partialFirmware);
          done();
        });
      });
    });
  });

  describe('get_firmware_info', () => {
    it('strips null values left after filling from the stored snapshot', (done) => {
      // eslint-disable-next-line global-require
      const rewire = require('rewire');
      const hardware = rewire('../../../../../lib/agent/providers/hardware');
      const read = { ...partialFirmware, mb_serial: null, vendor_name: null };
      // eslint-disable-next-line no-underscore-dangle
      hardware.__set__('osFunctions', { get_firmware_info: (cb) => cb(null, read) });
      storeHardware(specsWith({ ...completeFirmware, vendor_name: '' }));

      hardware.get_firmware_info((err, data) => {
        expect(err).to.be.null;
        expect(data.mb_serial).to.equal(completeFirmware.mb_serial);
        expect(data).to.not.have.property('vendor_name');
        done();
      });
    });
  });

  describe('compareField with missing values', () => {
    it('a partial read against a complete baseline is not a change', () => {
      exp.compareField(specsWith(partialFirmware), specsWith(completeFirmware));
      expect(exp.diffCount).to.equal(0);
    });

    it('a complete read against a partial baseline is not a change', () => {
      exp.compareField(specsWith(completeFirmware), specsWith(partialFirmware));
      expect(exp.diffCount).to.equal(0);
    });

    it('missing values on either side are not a change', () => {
      const complete = specsWith(completeFirmware);
      exp.compareField(specsWith({ ...completeFirmware, mb_serial: '' }), complete);
      exp.compareField(complete, specsWith({ ...completeFirmware, mb_serial: '-' }));
      exp.compareField(complete, specsWith({ ...completeFirmware, mb_serial: null }));
      expect(exp.diffCount).to.equal(0);
    });

    it('firmware filler strings are real values: a transition is a change', () => {
      exp.compareField(specsWith(completeFirmware), specsWith({ ...completeFirmware, mb_serial: 'NA' }));
      expect(exp.diffCount).to.equal(1);
      const filler = specsWith({ ...completeFirmware, mb_serial: 'Default string' });
      exp.compareField(filler, specsWith(completeFirmware));
      expect(exp.diffCount).to.equal(2);
    });

    it('the same firmware filler on both sides is not a change', () => {
      const filler = { ...completeFirmware, serial_number: 'To be filled by O.E.M.' };
      exp.compareField(specsWith(filler), specsWith(filler));
      expect(exp.diffCount).to.equal(0);
    });

    it('a different motherboard serial is still a change', () => {
      exp.compareField(specsWith({ ...completeFirmware, mb_serial: 'NEWBOARD123' }), specsWith(completeFirmware));
      expect(exp.diffCount).to.be.greaterThan(0);
    });
  });

  describe('track_hardware_changes baseline', () => {
    it('completes a partial baseline silently, without hardware_changed', () => {
      storeHardware(specsWith(partialFirmware));
      exp.track_hardware_changes(specsWith(completeFirmware));

      expect(triggerStub.calledWith('hardware_changed')).to.be.false;
      expect(saveDataDbKeyStub.called).to.be.true;
      expect(savedBaseline(saveDataDbKeyStub).firmware_info).to.deep.equal(completeFirmware);
    });

    it('a firmware filler that replaces a real value is stored as the new baseline', () => {
      storeHardware(specsWith(completeFirmware));
      exp.track_hardware_changes(specsWith({ ...completeFirmware, mb_serial: 'Default string' }));

      expect(triggerStub.calledWith('hardware_changed')).to.be.true;
      expect(savedBaseline(saveDataDbKeyStub).firmware_info.mb_serial).to.equal('Default string');
    });

    it('ignores a partial read against a complete baseline and keeps the baseline', () => {
      storeHardware(specsWith(completeFirmware));
      exp.track_hardware_changes(specsWith(partialFirmware));

      expect(triggerStub.calledWith('hardware_changed')).to.be.false;
      expect(saveDataDbKeyStub.called).to.be.false;
    });

    it('on a real change, stores the new values but keeps stored ones the read missed', () => {
      storeHardware(specsWith(completeFirmware));
      const current = specsWith({ ...completeFirmware, mb_serial: 'NEWBOARD123' });
      delete current.firmware_info.bios_vendor;
      exp.track_hardware_changes(current);

      expect(triggerStub.calledWith('hardware_changed')).to.be.true;
      const baseline = savedBaseline(saveDataDbKeyStub).firmware_info;
      expect(baseline.mb_serial).to.equal('NEWBOARD123');
      expect(baseline.bios_vendor).to.equal(completeFirmware.bios_vendor);
    });
  });

  describe('unreadable hardware_changed row', () => {
    const CORRUPT = '{"hardwareData":[{"time":"2026-11-27T10:00:00.000Z","dataTrack":{"proc';

    it('starts a new history instead of throwing', (done) => {
      exp.storedComparisonDataHardwareChanged([{ value: CORRUPT }], { a: 1 }, (err, storedData) => {
        expect(err).to.be.null;
        expect(storedData.hardwareData).to.have.lengthOf(1);
        expect(storedData.hardwareData[0].dataTrack).to.deep.equal({ a: 1 });
        done();
      });
    });

    it('rewrites the row through updateDataHardwareChanged', () => {
      // updateDataDbKey is already stubbed by this block's beforeEach.
      const updateStub = /** @type {any} */ (utilStorage.updateDataDbKey);
      getDataDbKeyStub.callsFake((key, cb) => cb(null, [{ value: CORRUPT }]));
      expect(() => exp.updateDataHardwareChanged({ a: 1 })).to.not.throw();
      expect(updateStub.calledOnce).to.be.true;
      const [, id, , value] = updateStub.firstCall.args;
      expect(id).to.equal('hardware_changed');
      expect(JSON.parse(value).hardwareData).to.have.lengthOf(1);
    });
  });
});
