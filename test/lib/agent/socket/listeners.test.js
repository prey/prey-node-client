/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/agent/socket/listeners.test.js
const sinon = require('sinon');
const chai = require('chai');

const { expect } = chai;
const config = require('../../../../lib/utils/configfile');
const listeners = require('../../../../lib/agent/socket/listeners');
const { nameArray } = require('../../../../lib/agent/socket/messages');

describe('listeners', () => {
  let savedWifiLocation;
  let savedNativeLocation;

  beforeEach(() => {
    savedWifiLocation = config.preyConfiguration['control-panel.permissions.wifi_location'];
    savedNativeLocation = config.preyConfiguration['control-panel.permissions.native_location'];
    config.preyConfiguration['control-panel.permissions.wifi_location'] = 'false';
    config.preyConfiguration['control-panel.permissions.native_location'] = 'false';
  });

  afterEach(() => {
    config.preyConfiguration['control-panel.permissions.wifi_location'] = savedWifiLocation;
    config.preyConfiguration['control-panel.permissions.native_location'] = savedNativeLocation;
  });

  it('should update native and wifi location info on MacOs', () => {
    const data = [
      nameArray[1],
      { result: true },
      sinon.stub(),
    ];

    const permissionFileStub = sinon.stub().callsFake((_x, _y, z) => {
      z();
    });
    const networkStub = sinon.stub().callsFake((z) => {
      z({ lat: 1, log: 2, accuracy: 3 });
    });
    const apiStub = sinon.stub().callsFake(() => {});

    listeners.osName = 'mac';
    listeners.setDataToPermissionFile = permissionFileStub;
    listeners.isWifiPermissionActive = networkStub;
    listeners.callApi = apiStub;

    listeners.reactToCheckLocationPerms(data);

    expect(permissionFileStub.calledWith('nativeLocation', true)).to.be.true;
    expect(networkStub.called).to.be.true;
    expect(apiStub.called).to.be.true;
  });

  it('should update native and wifi location info on Windows', () => {
    const data = [
      nameArray[1],
      'Allow',
      sinon.stub(),
    ];

    const permissionFileStub = sinon.stub().callsFake((_x, _y, z) => {
      z();
    });
    const networkStub = sinon.stub().callsFake((z) => {
      z({ lat: 1, log: 2, accuracy: 3 });
    });
    const apiStub = sinon.stub().callsFake(() => {});

    listeners.osName = 'windows';
    listeners.setDataToPermissionFile = permissionFileStub;
    listeners.isWifiPermissionActive = networkStub;
    listeners.callApi = apiStub;

    listeners.reactToCheckLocationPerms(data);

    expect(permissionFileStub.calledWith('wifiLocation', 'true')).to.be.true;
    expect(apiStub.called).to.be.true;
  });

  it('should process WiFi info and call callback with result', () => {
    const data = [
      'wdutil',
      {
        wdutil: {
          WIFI: {
            RSSI: '-50',
            SSID: 'my_wifi',
            'MAC Address': '00:11:22:33:44:55',
            Channel: '6',
            Security: 'WPA2',
          },
        },
      },
      sinon.stub(),
    ];

    const callbackStub = data[2];

    listeners.reactToWdutil(data);

    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('should call callback with location info', () => {
    const data = [
      'get_location_mac_svc',
      { location: 'my location' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getLocationMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('should call callback with picture info', () => {
    const data = [
      'get_picture_mac_svc',
      { picture: 'my picture' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getPictureMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('should call callback with screenshot info', () => {
    const data = [
      'get_screenshot_mac_svc',
      { screenshot: 'my screenshot' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getScreenshotMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('should call callback with agent screenshot info', () => {
    const data = [
      'get_screenshot_agent_mac_svc',
      { screenshot: 'my agent screenshot' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getScreenshotAgentMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('should call callback with agent screenshot data', () => {
    const data = [
      'get_screenshot_agent_mac_svc',
      { screenshot: 'my agent screenshot' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getScreenshotAgentMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('should call callback', () => {
    const data = [
      'reac_to_watcher',
      {},
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.reacToWatcher(data);
    expect(callbackStub.called).to.be.true;
  });

  // Regression for the production crash: `config.getData` can return a raw
  // boolean (e.g. synced from the control panel without string coercion),
  // which used to be compared directly with `.localeCompare` and throw.
  describe('regression: non-string permission config values', () => {
    it('should not throw on MacOs when config permission values are raw booleans', () => {
      config.preyConfiguration['control-panel.permissions.wifi_location'] = true;
      config.preyConfiguration['control-panel.permissions.native_location'] = true;

      const data = [nameArray[1], { result: true }, sinon.stub()];
      const permissionFileStub = sinon.stub().callsFake((_x, _y, z) => z());
      const networkStub = sinon.stub().callsFake((z) => z(true));

      listeners.osName = 'mac';
      listeners.setDataToPermissionFile = permissionFileStub;
      listeners.isWifiPermissionActive = networkStub;
      listeners.callApi = sinon.stub();

      expect(() => listeners.reactToCheckLocationPerms(data)).to.not.throw();
    });

    it('should not throw on Windows when config permission value is a raw boolean', () => {
      config.preyConfiguration['control-panel.permissions.wifi_location'] = false;
      config.preyConfiguration['control-panel.permissions.native_location'] = false;

      const data = [nameArray[1], 'Allow', sinon.stub()];
      const permissionFileStub = sinon.stub().callsFake((_x, _y, z) => z());

      listeners.osName = 'windows';
      listeners.setDataToPermissionFile = permissionFileStub;
      listeners.callApi = sinon.stub();

      expect(() => listeners.reactToCheckLocationPerms(data)).to.not.throw();
    });

    it('should catch errors thrown inside the mac async callback chain and still invoke the socket reply callback', () => {
      const data = [nameArray[1], { result: true }, sinon.stub()];
      const permissionFileStub = sinon.stub().callsFake((_x, _y, z) => z());
      // Simulate an unexpected non-string output reaching `output.toString()`.
      const networkStub = sinon.stub().callsFake((z) => z(null));

      listeners.osName = 'mac';
      listeners.setDataToPermissionFile = permissionFileStub;
      listeners.isWifiPermissionActive = networkStub;

      expect(() => listeners.reactToCheckLocationPerms(data)).to.not.throw();
      expect(data[2].called).to.be.true;
    });
  });
});
