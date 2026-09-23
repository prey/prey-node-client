/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const rewire = require('rewire');

const MODULE_PATH = '../../../../../lib/agent/providers/hardware/mac';

/**
 * Builds a fake child_process.exec that dispatches canned stdout per command.
 * @param {{ hardware?: string, bridge?: string, hardwareErr?: Error }} responses
 */
const makeFakeExec = (responses) => (cmd, options, cb) => {
  const done = typeof options === 'function' ? options : cb;
  if (cmd.indexOf('SPHardwareDataType') !== -1) {
    if (responses.hardwareErr) return done(responses.hardwareErr);
    return done(null, responses.hardware || '', '');
  }
  if (cmd.indexOf('SPiBridgeDataType') !== -1) {
    return done(null, responses.bridge || '', '');
  }
  return done(null, '', '');
};

/**
 * Loads mac.js (rewired) with stubbed exec / si / system.
 * @param {{ exec: Function, siSystem?: Function }} deps
 */
const loadMac = (deps) => {
  const mac = rewire(MODULE_PATH);
  mac.__set__('exec', deps.exec);
  mac.__set__('si', {
    system: deps.siSystem || ((cb) => cb({})),
    mem: (cb) => cb({ total: 0 }),
  });
  mac.__set__('system', {
    is_m1_or_m2: () => false,
    get_info_chip: () => 'Apple M2',
    get_processor_info: () => {},
    get_prey_user_version: () => {},
  });
  return mac;
};

describe('hardware/mac get_firmware_info', () => {
  it('happy path: MacBook is reported as Laptop', (done) => {
    const hardware = [
      'Hardware:',
      '',
      '    Hardware Overview:',
      '',
      '      Model Name: MacBook Pro',
      '      Boot ROM Version: 10151.140.19',
      '      Serial Number (system): C02XYZ123',
      '      Hardware UUID: ABCD-1234',
      '',
    ].join('\n');

    const mac = loadMac({ exec: makeFakeExec({ hardware }) });
    mac.get_firmware_info((err, data) => {
      expect(err).to.be.null;
      expect(data.device_type).to.equal('Laptop');
      expect(data.model_name).to.equal('MacBook Pro');
      expect(data.serial_number).to.equal('C02XYZ123');
      expect(data.uuid).to.equal('ABCD-1234');
      done();
    });
  });

  it('happy path: Mac mini is reported as Desktop', (done) => {
    const hardware = [
      '    Hardware Overview:',
      '      Model Name: Mac mini',
      '',
    ].join('\n');

    const mac = loadMac({ exec: makeFakeExec({ hardware }) });
    mac.get_firmware_info((err, data) => {
      expect(err).to.be.null;
      expect(data.device_type).to.equal('Desktop');
      expect(data.model_name).to.equal('Mac mini');
      done();
    });
  });

  it('does not crash when Model Name is missing; falls back to si.system()', (done) => {
    const hardware = [
      '    Hardware Overview:',
      '      Boot ROM Version: 10151.140.19',
      '',
    ].join('\n');
    const siSystem = (cb) => cb({ model: 'MacBook Air', serial: 'FALLBACK-SER', uuid: 'FALLBACK-UUID' });

    const mac = loadMac({ exec: makeFakeExec({ hardware }), siSystem });
    mac.get_firmware_info((err, data) => {
      expect(err).to.be.null;
      expect(data.model_name).to.equal('MacBook Air');
      expect(data.device_type).to.equal('Laptop');
      expect(data.serial_number).to.equal('FALLBACK-SER');
      expect(data.uuid).to.equal('FALLBACK-UUID');
      done();
    });
  });

  it('does not crash on completely empty system_profiler output', (done) => {
    const mac = loadMac({ exec: makeFakeExec({ hardware: '' }), siSystem: (cb) => cb({}) });
    mac.get_firmware_info((err, data) => {
      expect(err).to.be.null;
      expect(data.model_name).to.equal('');
      expect(data.device_type).to.equal('Desktop');
      expect(data.serial_number).to.be.null;
      done();
    });
  });

  it('fallback that also fails: still calls back once with safe defaults', (done) => {
    let calls = 0;
    const mac = loadMac({ exec: makeFakeExec({ hardware: '' }), siSystem: (cb) => cb(undefined) });
    mac.get_firmware_info((err, data) => {
      calls += 1;
      expect(err).to.be.null;
      expect(data.model_name).to.equal('');
      expect(data.device_type).to.equal('Desktop');
      setTimeout(() => {
        expect(calls).to.equal(1);
        done();
      }, 30);
    });
  });

  it('propagates a hard error from SPHardwareDataType', (done) => {
    const mac = loadMac({ exec: makeFakeExec({ hardwareErr: new Error('boom') }) });
    mac.get_firmware_info((err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.equal('boom');
      done();
    });
  });
});
