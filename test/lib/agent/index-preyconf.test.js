/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

// What an unescaped `'--` in an exceptions quota UPDATE used to leave in every keys
// row: truncated JSON. Parsing it at boot threw from a storage callback and the
// service crash-looped, since every restart read the same row.
const CORRUPT = '{"date":"2026-11-27","total":1,"errors":{"unknown option ';

describe('agent/index — unreadable keys rows at boot', () => {
  let agentIndex;
  let logger;

  beforeEach(() => {
    agentIndex = rewire('../../../lib/agent/index');
    logger = {
      error: sinon.stub(), notice: sinon.stub(), warn: sinon.stub(), info: sinon.stub(), debug: sinon.stub(),
    };
    agentIndex.__set__('logger', logger);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('preyConfReconf', () => {
    it('does not throw on an unreadable preyconf row and lets the config rewrite it', () => {
      const getShould = sinon.stub();
      getShould.onFirstCall().callsFake((cb) => cb(null, null));
      agentIndex.__set__('getDataFromShouldPreyCFile', getShould);
      agentIndex.__set__('getDataDb', (key, cb) => cb(null, [{ value: CORRUPT }]));

      expect(() => agentIndex.__get__('preyConfReconf')()).to.not.throw();
      expect(logger.warn.calledWithMatch(/Ignoring unreadable preyconf row/)).to.be.true;
      expect(getShould.calledTwice).to.be.true;
      expect(getShould.secondCall.args[0]).to.equal(agentIndex.__get__('reactToDataFromShouldPreyCFile'));
    });

    it('keeps the valid-row path unchanged', () => {
      const getShould = sinon.stub();
      getShould.onFirstCall().callsFake((cb) => cb(null, null));
      agentIndex.__set__('getDataFromShouldPreyCFile', getShould);
      agentIndex.__set__('getDataDb', (key, cb) => cb(null, [{
        value: JSON.stringify({ 'control-panel.device_key': 'd', 'control-panel.api_key': 'a' }),
      }]));

      agentIndex.__get__('preyConfReconf')();
      expect(logger.warn.called).to.be.false;
      expect(getShould.calledTwice).to.be.true;
    });
  });

  describe('clearStaleSettingDeviceKey', () => {
    const withRow = (value) => {
      const storageDo = sinon.stub().callsFake((op, opts, cb) => {
        if (op === 'query') return cb(null, [{ id: 'settingDeviceKey', value }]);
        return cb(null);
      });
      agentIndex.__set__('storage', { do: storageDo });
      return storageDo;
    };

    it('deletes an unreadable row instead of throwing', () => {
      const storageDo = withRow(CORRUPT);
      expect(() => agentIndex.__get__('clearStaleSettingDeviceKey')()).to.not.throw();
      expect(storageDo.calledWith('del', { type: 'keys', id: 'settingDeviceKey' })).to.be.true;
      expect(logger.warn.calledWithMatch(/Ignoring unreadable settingDeviceKey row/)).to.be.true;
    });

    it('deletes a row older than 90 seconds', () => {
      const storageDo = withRow(JSON.stringify({ dateTime: Date.now() - 91000 }));
      agentIndex.__get__('clearStaleSettingDeviceKey')();
      expect(storageDo.calledWith('del')).to.be.true;
    });

    it('keeps a recent row', () => {
      const storageDo = withRow(JSON.stringify({ dateTime: Date.now() }));
      agentIndex.__get__('clearStaleSettingDeviceKey')();
      expect(storageDo.calledWith('del')).to.be.false;
    });
  });
});
