/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');
const path = require('path');

const INDEX_PATH = require.resolve('../../../lib/agent/index');

/**
 * @param {Object<string, any>} stubs keyed by the exact request string index.js uses
 * @returns {any} the freshly loaded agent module
 */
const loadAgent = (stubs) => {
  const originalLoad = Module._load;
  Module._load = function stubbedLoad(request, parent, ...rest) {
    if (parent && parent.filename === INDEX_PATH
      && Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }
    return originalLoad.call(this, request, parent, ...rest);
  };
  try {
    delete require.cache[INDEX_PATH];
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(INDEX_PATH);
  } finally {
    Module._load = originalLoad;
    delete require.cache[INDEX_PATH];
  }
};

describe('agent run → updater.check_for_update → boot (static install)', () => {
  let stubs;
  let controlPanel;
  let triggers;
  let configData;
  let packageStub;
  let updaterSetInterval;
  let originalTitle;
  let originalRunningUser;

  const staticUpdater = () => {
    const updater = rewire('../../../lib/agent/updater');
    packageStub = {
      new_version_available: sinon.stub(),
      check_update_success: sinon.stub(),
    };
    updater.__set__('common', { package: packageStub, version: '1.13.41' });
    const pkgDir = path.join('/opt', 'prey');
    updater.__set__('system', { paths: { current: pkgDir, package: pkgDir, versions: undefined } });
    updater.__set__('logger', {
      info: sinon.stub(),
      debug: sinon.stub(),
      notice: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    });
    updaterSetInterval = sinon.stub().returns({});
    updater.__set__('setInterval', updaterSetInterval);
    updater.check_enabled = true;
    updater.upgrading = false;
    return updater;
  };

  beforeEach(() => {
    originalTitle = process.title;
    originalRunningUser = process.env.RUNNING_USER;

    configData = { auto_update: true };
    controlPanel = { load: sinon.stub() };
    triggers = { watch: sinon.stub(), unwatch: sinon.stub() };

    const logger = {
      pause: sinon.stub(),
      write: sinon.stub(),
      paint: (str) => str,
      debug: sinon.stub(),
      info: sinon.stub(),
      notice: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    stubs = {
      './common': {
        system: { get_running_user: () => 'root' },
        logger,
        program: {},
        exceptions: { send: sinon.stub() },
        os_name: 'linux',
        os_release: 'test',
        version: '1.13.41',
        writeFileLoggerRestart: sinon.stub(),
        countLinesLoggerRestarts: sinon.stub(),
      },
      './updater': staticUpdater(),
      './hooks': { on: sinon.stub(), unload: sinon.stub() },
      './commands': {
        run_stored: sinon.stub(), start_watching: sinon.stub(), stop_watching: sinon.stub(),
      },
      './actions': { stop_all: sinon.stub() },
      './triggers': triggers,
      './reports': { cancel_all: sinon.stub() },
      './providers': { remove_files: sinon.stub() },
      './utils/prey-configuration/preyconf': {
        correctPreyConf: sinon.stub(),
        getDataDb: (_key, cb) => cb(null, []),
        readWithoutVerification: sinon.stub(),
      },
      '../utils/configutil': { saveToDbKey: (_k, _v, cb) => cb() },
      './utils/storage': { do: (_op, _opts, cb) => cb(null, []) },
      './utils/storage/restore': { restore: (cb) => cb() },
      './control-panel/setup': { start: sinon.stub() },
      '../utils/skippedPermissions': { load: (cb) => cb() },
      './utils/logo': '',
      './control-panel': controlPanel,
      '../utils/configfile': {
        load: (cb) => { if (typeof cb === 'function') cb(); },
        getData: (key) => configData[key],
        setData: sinon.stub(),
        all: () => configData,
      },
      '../utils/fetch-env-var': () => ({}),
    };
  });

  afterEach(() => {
    process.title = originalTitle;
    if (originalRunningUser === undefined) delete process.env.RUNNING_USER;
    else process.env.RUNNING_USER = originalRunningUser;
    sinon.restore();
  });

  it('boots (loads the control panel) when check_for_update reports NO_VERSIONS_SUPPORT', (done) => {
    const agent = loadAgent(stubs);
    const checkSpy = sinon.spy(stubs['./updater'], 'check_for_update');

    controlPanel.load.callsFake(() => {
      expect(checkSpy.calledOnce).to.be.true;
      expect(packageStub.new_version_available.called).to.be.false;
      done();
    });

    agent.run();
  });

  it('finishes boot without arming update timers (check_every is a no-op)', (done) => {
    const agent = loadAgent(stubs);
    const checkEverySpy = sinon.spy(stubs['./updater'], 'check_every');

    controlPanel.load.callsFake((cb) => cb());
    triggers.watch.callsFake(() => {
      expect(checkEverySpy.calledOnce).to.be.true;
      expect(updaterSetInterval.called).to.be.false;
      done();
    });

    agent.run();
  });

  it('does NOT boot when check_for_update calls back without an error (contract index.js relies on)', () => {
    stubs['./updater'] = {
      check_for_update: (cb) => cb(),
      check_every: sinon.stub(),
      stop_checking: sinon.stub(),
    };
    const agent = loadAgent(stubs);

    agent.run();

    expect(controlPanel.load.called).to.be.false;
  });
});
