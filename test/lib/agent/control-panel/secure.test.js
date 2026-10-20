/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const { EventEmitter } = require('events');

const BIN = '/opt/prey/lib/conf/panel/linux/prey-config-gtk4';
const LINK = 'https://panel.preyproject.com/auth/configuration/start/eyJhIjoxfQ==';

describe('secure', () => {
  let secure;

  beforeEach(() => {
    secure = rewire('../../../../lib/agent/control-panel/secure');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('buildConfigCommand', () => {
    let build;

    beforeEach(() => {
      build = secure.__get__('buildConfigCommand');
    });

    it('passes DISPLAY and XAUTHORITY through env(1) for an x11 session', () => {
      const { command, args } = build('jdoe', BIN, LINK, {
        user: 'jdoe', uid: '1000', type: 'x11', display: ':0', xauthority: '/home/jdoe/.Xauthority',
      });

      expect(command).to.equal('sudo');
      expect(args).to.deep.equal([
        '-u', 'jdoe', '/usr/bin/env',
        'DISPLAY=:0',
        'XAUTHORITY=/home/jdoe/.Xauthority',
        BIN, LINK,
      ]);
    });

    it('adds XDG_RUNTIME_DIR and WAYLAND_DISPLAY for a wayland session', () => {
      const { args } = build('jdoe', BIN, LINK, {
        user: 'jdoe',
        uid: '1000',
        type: 'wayland',
        display: ':0',
        xauthority: '/run/user/1000/.mutter-Xwaylandauth.ABC123',
      });

      expect(args).to.deep.equal([
        '-u', 'jdoe', '/usr/bin/env',
        'DISPLAY=:0',
        'XAUTHORITY=/run/user/1000/.mutter-Xwaylandauth.ABC123',
        'XDG_RUNTIME_DIR=/run/user/1000',
        'WAYLAND_DISPLAY=wayland-0',
        BIN, LINK,
      ]);
    });

    it('accepts a numeric uid', () => {
      const { args } = build('jdoe', BIN, LINK, { type: 'wayland', uid: 1000 });
      expect(args).to.include('XDG_RUNTIME_DIR=/run/user/1000');
    });

    it('leaves out variables whose value is null or empty', () => {
      const { args } = build('jdoe', BIN, LINK, {
        user: 'jdoe', uid: '1000', type: 'x11', display: null, xauthority: '',
      });

      expect(args).to.deep.equal(['-u', 'jdoe', '/usr/bin/env', BIN, LINK]);
    });

    it('skips the wayland variables when the uid is unknown or not numeric', () => {
      [undefined, null, '', 'abc', '1000; rm -rf /'].forEach((uid) => {
        const { args } = build('jdoe', BIN, LINK, { type: 'wayland', uid, display: ':0' });
        expect(args).to.deep.equal(['-u', 'jdoe', '/usr/bin/env', 'DISPLAY=:0', BIN, LINK]);
      });
    });

    it('still runs the GUI through env(1) when no session env is available', () => {
      expect(build('jdoe', BIN, LINK, null).args).to.deep.equal(['-u', 'jdoe', '/usr/bin/env', BIN, LINK]);
      expect(build('jdoe', BIN, LINK).args).to.deep.equal(['-u', 'jdoe', '/usr/bin/env', BIN, LINK]);
    });

    it('keeps values with shell metacharacters as single, unquoted argv entries', () => {
      const xauth = "/home/o'brien/my dir/.Xauthority";
      const { args } = build("o'brien", BIN, `${LINK};id`, { display: ':1 $(id)', xauthority: xauth });

      expect(args).to.deep.equal([
        '-u', "o'brien", '/usr/bin/env',
        'DISPLAY=:1 $(id)',
        `XAUTHORITY=${xauth}`,
        BIN, `${LINK};id`,
      ]);
    });
  });

  describe('open_config on linux (adapter path: get_logged_user → get_env → spawn)', () => {
    let setTimeoutStub;
    let spawnStub;
    let child;
    let exitStub;
    let loggerStub;
    let sessionEnv;
    let envError;
    let originalDisplay;
    let originalXauthority;

    beforeEach(() => {
      setTimeoutStub = sinon.stub().callsFake((fn) => fn());
      secure.__set__('setTimeout', setTimeoutStub);
      originalDisplay = process.env.DISPLAY;
      originalXauthority = process.env.XAUTHORITY;

      child = new EventEmitter();
      child.unref = sinon.stub();
      spawnStub = sinon.stub().returns(child);
      exitStub = sinon.stub(process, 'exit');
      loggerStub = { error: sinon.stub(), info: sinon.stub(), warn: sinon.stub() };
      envError = null;
      sessionEnv = {
        user: 'jdoe', uid: '1000', type: 'wayland', display: ':0', xauthority: '/run/user/1000/xauth_abc',
      };

      secure.__set__('osName', 'linux');
      secure.__set__('cp', { spawn: spawnStub, exec: sinon.stub() });
      secure.__set__('exec', sinon.stub());
      secure.__set__('logger', loggerStub);
      secure.__set__('config', {
        getData: (key) => ({
          'control-panel.protocol': 'https',
          'control-panel.host': 'solid.preyproject.com',
        })[key],
      });
      secure.__set__('common', {
        system: { lang: 'en' },
        version: '1.13.41',
        os_release: '24.04',
        root_path: '/opt/prey',
      });
      secure.__set__('system', {
        get_logged_user: (cb) => cb(null, 'jdoe'),
        get_env: (cb) => cb(envError, envError ? undefined : sessionEnv),
      });
      secure.generate_keys = (cb) => cb(null);
    });

    afterEach(() => {
      if (originalDisplay === undefined) delete process.env.DISPLAY;
      else process.env.DISPLAY = originalDisplay;
      if (originalXauthority === undefined) delete process.env.XAUTHORITY;
      else process.env.XAUTHORITY = originalXauthority;
    });

    const openConfig = () => {
      const cb = sinon.stub();
      secure.open_config('device-key', cb);
      expect(setTimeoutStub.firstCall.args[1]).to.equal(3000);
      return cb;
    };

    it('spawns sudo -u <user> /usr/bin/env ... <prey-config> <link>, detached, without a shell', () => {
      const cb = openConfig();

      expect(cb.calledOnce).to.be.true;
      expect(spawnStub.calledOnce).to.be.true;
      const [command, args, opts] = spawnStub.firstCall.args;
      expect(command).to.equal('sudo');
      expect(args.slice(0, 3)).to.deep.equal(['-u', 'jdoe', '/usr/bin/env']);
      expect(args).to.include('DISPLAY=:0');
      expect(args).to.include('XAUTHORITY=/run/user/1000/xauth_abc');
      expect(args).to.include('XDG_RUNTIME_DIR=/run/user/1000');
      expect(args).to.include('WAYLAND_DISPLAY=wayland-0');
      expect(args[args.length - 2]).to.equal('/opt/prey/lib/conf/panel/linux/prey-config-gtk4');
      expect(args[args.length - 1]).to.match(/^https:\/\/panel\.preyproject\.com\/auth\/configuration\/start\//);
      expect(opts).to.include({ detached: true, stdio: 'ignore' });
      expect(opts).to.not.have.property('shell');
    });

    it('no longer relies on (or touches) this process DISPLAY/XAUTHORITY', () => {
      process.env.DISPLAY = ':99';
      process.env.XAUTHORITY = '/root/.Xauthority';
      openConfig();
      expect(process.env.DISPLAY).to.equal(':99');
      expect(process.env.XAUTHORITY).to.equal('/root/.Xauthority');
    });

    it('opens without session variables when get_env fails', () => {
      envError = new Error('Cannot detect graphical user');
      openConfig();
      const args = spawnStub.firstCall.args[1];
      expect(args.slice(0, 4)).to.deep.equal([
        '-u', 'jdoe', '/usr/bin/env', '/opt/prey/lib/conf/panel/linux/prey-config-gtk4',
      ]);
      expect(args).to.have.lengthOf(5); // ... <bin> <link>, no VAR=value in between
    });

    it('detaches and exits once the GUI has been spawned', () => {
      openConfig();
      expect(exitStub.called).to.be.false;
      child.emit('spawn');
      expect(child.unref.calledOnce).to.be.true;
      expect(exitStub.calledOnce).to.be.true;
    });

    it('logs and stays alive when the GUI cannot be spawned', () => {
      openConfig();
      child.emit('error', new Error('spawn sudo ENOENT'));
      expect(exitStub.called).to.be.false;
      expect(loggerStub.error.calledWithMatch(/spawn sudo ENOENT/)).to.be.true;
    });

    it('does nothing when there is no logged user', () => {
      secure.__set__('system', {
        get_logged_user: (cb) => cb(new Error("Couldn't find logged user.")),
        get_env: sinon.stub(),
      });
      const cb = openConfig();
      expect(cb.calledOnce).to.be.true;
      expect(spawnStub.called).to.be.false;
    });
  });
});
