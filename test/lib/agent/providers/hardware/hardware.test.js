/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const exp = require('../../../../../lib/agent/providers/hardware');
const utilStorage = require('../../../../../lib/agent/utils/storage/utilstorage');

describe('Hardware_Provider', () => {
  let deleteDbKeyStub;
  let getDataDbKeyStub;
  let saveDataDbKeyStub;
  let updateDataDbKeyStub;
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
  });

  describe('track_hardware_changes', () => {
    it('should track hardware changes correctly', (done) => {
      getDataDbKeyStub.callsFake((_method, cb) => {
        cb(null, hardware2);
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
      exp.track_hardware_changes(hardware1);

      setTimeout(() => {
        expect(getDataDbKeyStub.calledTwice).to.be.true;
        expect(deleteDbKeyStub.calledOnce).to.be.true;
        expect(exp.diffCount).to.be.equal(1);
        sinon.assert.calledThrice(saveDataDbKeyStub);
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
});
