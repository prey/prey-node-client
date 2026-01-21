/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/agent/socket/listeners.test.js
const sinon = require('sinon');
const chai = require('chai');

const { expect } = chai;
const listeners = require('../../../../lib/agent/socket/listeners');

describe('listeners', () => {
  it('should update native and wifi location info on MacOs', () => {
    const data = [
      'check_location_perms',
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
      'check_location_perms',
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
});
