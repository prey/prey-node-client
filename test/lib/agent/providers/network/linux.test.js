/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

const WIFI_LIST_CMD = 'sudo nmcli -t -f BSSID,SSID,CHAN,SIGNAL,SECURITY device wifi list';
const WIFI_RESCAN_CMD = 'sudo nmcli device wifi rescan';

const listLine = (mac, ssid, channel = 1, signal = 70, security = 'WPA2') => `${mac}:${ssid}:${channel}:${signal}:${security}`;

const listWithCount = (count) => {
  const lines = [];

  for (let i = 1; i <= count; i += 1) {
    const octet = `${i}`.padStart(2, '0');
    lines.push(listLine(`AA\\:BB\\:CC\\:DD\\:EE\\:${octet}`, `Net-${i}`, i, 50 + i, 'WPA2'));
  }

  return lines.join('\n');
};

const getAccessPointsListAsync = (linuxProvider, attempt, useNmcli = true) => new Promise((resolve, reject) => {
  linuxProvider.get_access_points_list((err, list) => {
    if (err) return reject(err);
    return resolve(list);
  }, attempt, useNmcli);
});

describe('Network Linux Provider', () => {
  let linuxProvider;
  let setTimeoutStub;

  beforeEach(() => {
    linuxProvider = rewire('../../../../../lib/agent/providers/network/linux');
    linuxProvider.__set__('lastForcedRescanAt', 0);
    setTimeoutStub = sinon.stub().callsFake((fn) => {
      fn();
      return 1;
    });
    linuxProvider.__set__('setTimeout', setTimeoutStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('get_access_points_list', () => {
    it('returns cached nmcli list without rescan when AP count is >= 4', async () => {
      const execStub = sinon.stub().callsFake((cmd, opts, cb) => {
        if (cmd === WIFI_LIST_CMD) return cb(null, listWithCount(4), '');
        return cb(new Error(`Unexpected command: ${cmd}`));
      });

      linuxProvider.__set__('exec', execStub);

      const list = await getAccessPointsListAsync(linuxProvider);

      expect(list).to.have.lengthOf(4);
      expect(execStub.calledWith(WIFI_RESCAN_CMD)).to.be.false;
    });

    it('forces one nmcli rescan when cached AP count is below threshold and returns fresher list', async () => {
      let listCalls = 0;
      const execStub = sinon.stub().callsFake((cmd, opts, cb) => {
        if (cmd === WIFI_LIST_CMD) {
          listCalls += 1;
          if (listCalls === 1) return cb(null, listWithCount(2), '');
          return cb(null, listWithCount(5), '');
        }
        if (cmd === WIFI_RESCAN_CMD) return cb(null, '', '');
        return cb(new Error(`Unexpected command: ${cmd}`));
      });

      linuxProvider.__set__('exec', execStub);

      const list = await getAccessPointsListAsync(linuxProvider);

      expect(list).to.have.lengthOf(5);
      expect(execStub.withArgs(WIFI_RESCAN_CMD).callCount).to.equal(1);
    });

    it('keeps cached list when fresh nmcli scan returns fewer APs', async () => {
      let listCalls = 0;
      const execStub = sinon.stub().callsFake((cmd, opts, cb) => {
        if (cmd === WIFI_LIST_CMD) {
          listCalls += 1;
          if (listCalls === 1) return cb(null, listWithCount(3), '');
          return cb(null, listWithCount(1), '');
        }
        if (cmd === WIFI_RESCAN_CMD) return cb(null, '', '');
        return cb(new Error(`Unexpected command: ${cmd}`));
      });

      linuxProvider.__set__('exec', execStub);

      const list = await getAccessPointsListAsync(linuxProvider);

      expect(list).to.have.lengthOf(3);
      expect(execStub.withArgs(WIFI_RESCAN_CMD).callCount).to.equal(1);
    });

    it('does not rescan again while within cooldown window', async () => {
      let listCalls = 0;
      const execStub = sinon.stub().callsFake((cmd, opts, cb) => {
        if (cmd === WIFI_LIST_CMD) {
          listCalls += 1;
          if (listCalls === 1) return cb(null, listWithCount(1), '');
          if (listCalls === 2) return cb(null, listWithCount(2), '');
          return cb(null, listWithCount(1), '');
        }
        if (cmd === WIFI_RESCAN_CMD) return cb(null, '', '');
        return cb(new Error(`Unexpected command: ${cmd}`));
      });

      linuxProvider.__set__('exec', execStub);

      const firstList = await getAccessPointsListAsync(linuxProvider);

      const secondList = await getAccessPointsListAsync(linuxProvider);

      expect(firstList).to.have.lengthOf(2);
      expect(secondList).to.have.lengthOf(1);
      expect(execStub.withArgs(WIFI_RESCAN_CMD).callCount).to.equal(1);
    });

    it('falls back to iwlist alternative when nmcli returns empty after rescan', async () => {
      let listCalls = 0;
      const fallbackList = [{ ssid: 'fallback-net', signal_strength: -60 }];
      const execStub = sinon.stub().callsFake((cmd, opts, cb) => {
        if (cmd === WIFI_LIST_CMD) {
          listCalls += 1;
          if (listCalls === 1) return cb(null, '', '');
          return cb(null, '', '');
        }
        if (cmd === WIFI_RESCAN_CMD) return cb(null, '', '');
        return cb(new Error(`Unexpected command: ${cmd}`));
      });
      const fallbackStub = sinon.stub(linuxProvider, 'getAcessPointAlternative').callsFake((cb) => cb(null, fallbackList));

      linuxProvider.__set__('exec', execStub);

      const list = await getAccessPointsListAsync(linuxProvider);

      expect(list).to.deep.equal(fallbackList);
      expect(fallbackStub.calledOnce).to.be.true;
    });
  });

  describe('getAcessPointAlternative', () => {
    it('retries on first resource busy response when attempt is not provided', async () => {
      const wifiScanOutput = [
        'Cell 01 - Address: AA:BB:CC:DD:EE:FF',
        '          ESSID:"TestNet"',
        '          Encryption key:on',
        '          Quality=70/100  Signal level=-40 dBm',
      ].join('\n');

      const getInterfaceStub = sinon.stub().callsFake((cb) => cb(null, 'wlan0'));
      const sudoStub = sinon.stub();

      sudoStub.onCall(0).callsFake((cmd, args, cb) => cb(null, '', 'resource busy'));
      sudoStub.onCall(1).callsFake((cmd, args, cb) => cb(null, wifiScanOutput, ''));

      linuxProvider.__set__('get_first_wireless_interface', getInterfaceStub);
      linuxProvider.__set__('sudo', sudoStub);

      const promise = new Promise((resolve, reject) => {
        linuxProvider.getAcessPointAlternative((err, list) => {
          if (err) return reject(err);
          return resolve(list);
        });
      });

      const list = await promise;

      expect(list).to.have.lengthOf(1);
      expect(sudoStub.callCount).to.equal(2);
    });
  });
});
