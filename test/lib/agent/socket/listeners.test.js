/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/agent/socket/listeners.test.js
const sinon = require('sinon');
const chai = require('chai');

const { expect } = chai;
const listeners = require('../../../../lib/agent/socket/listeners');

describe('listeners', () => {
  // Aquí van a ir nuestros tests
  it('debería actualizar la información de ubicación nativa y wifi', () => {
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

    listeners.getDataFromPermissionFile = permissionFileStub;
    listeners.isWifiPermissionActive = networkStub;
    listeners.callApi = apiStub;

    listeners.reactToCheckLocationPerms(data);

    expect(permissionFileStub.calledWith('nativeLocation', true)).to.be.true;
    expect(networkStub.called).to.be.true;
    expect(apiStub.called).to.be.true;
  });

  it('debería procesar la información de WiFi y llamar al callback con el resultado', () => {
    const data = [
      'wdutil',
      {
        wdutil: {
          WIFI: {
            RSSI: '-50',
            SSID: 'mi_wifi',
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

  it('debería llamar al callback con la información de ubicación', () => {
    const data = [
      'get_location_mac_svc',
      { location: 'mi ubicación' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getLocationMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('debería llamar al callback con la información de la imagen', () => {
    const data = [
      'get_picture_mac_svc',
      { picture: 'mi imagen' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getPictureMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('debería llamar al callback con la información de la captura de pantalla', () => {
    const data = [
      'get_screenshot_mac_svc',
      { screenshot: 'mi captura de pantalla' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getScreenshotMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('debería llamar al callback con la información de la captura de pantalla del agente', () => {
    const data = [
      'get_screenshot_agent_mac_svc',
      { screenshot: 'mi captura de pantalla del agente' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getScreenshotAgentMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('debería llamar al callback con la información de la captura de pantalla del agente', () => {
    const data = [
      'get_screenshot_agent_mac_svc',
      { screenshot: 'mi captura de pantalla del agente' },
      sinon.stub(),
    ];

    const callbackStub = data[2];
    listeners.getScreenshotAgentMacSVC(data);
    expect(callbackStub.calledWith(null, sinon.match.object)).to.be.true;
  });

  it('debería llamar al callback', () => {
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
