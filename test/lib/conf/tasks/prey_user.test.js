/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('prey_user', () => {
  let preyUser;
  let fsStub;
  let chownrStub;
  let uidNumberStub;
  let execStub;
  let ocelotStub;

  const STATIC = {
    install_dir: '/opt/prey',
    current_dir: '/opt/prey',
    versions_dir: undefined,
    prey_bin: '/opt/prey/bin/prey',
  };
  const VERSIONED = {
    install_dir: '/usr/lib/prey',
    current_dir: '/usr/lib/prey/current',
    versions_dir: '/usr/lib/prey/versions',
    prey_bin: '/usr/lib/prey/versions/1.13.41/bin/prey',
  };

  /**
   * @param {{install_dir: string, current_dir: string, versions_dir: string|undefined,
   */
  const useLayout = (layout) => {
    Object.keys(layout).forEach((key) => preyUser.__set__(key, layout[key]));
  };

  const chownedPaths = () => chownrStub.args.map((call) => call[0]);

  beforeEach(() => {
    preyUser = rewire('../../../../lib/conf/tasks/prey_user');

    fsStub = {
      mkdir: sinon.stub().callsFake((dir, cb) => cb(null)),
      appendFile: sinon.stub().callsFake((file, data, cb) => cb(null)),
      readlinkSync: sinon.stub().throws(Object.assign(new Error('EINVAL'), { code: 'EINVAL' })),
      existsSync: sinon.stub().returns(true),
      unlinkSync: sinon.stub(),
    };
    chownrStub = sinon.stub().callsFake((p, uid, gid, cb) => cb(null));
    uidNumberStub = sinon.stub().callsFake((user, group, cb) => cb(null, 990, 990));
    execStub = sinon.stub().callsFake((cmd, cb) => cb(null, 'prey user already exists!\n'));
    ocelotStub = { exec_as: sinon.stub().callsFake((user, cmd, cb) => cb(null, 'ok\n', '')) };

    preyUser.__set__('fs', fsStub);
    preyUser.__set__('chownr', chownrStub);
    preyUser.__set__('uid_number', uidNumberStub);
    preyUser.__set__('exec', execStub);
    preyUser.__set__('ocelot', ocelotStub);
    preyUser.__set__('shared', { log: sinon.stub() });
    preyUser.__set__('is_windows', false);
    preyUser.__set__('config_dir', '/etc/prey');
    preyUser.__set__('log_file', '/var/log/prey/prey.log');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('setup_permissions', () => {
    describe('static install (no versions dir)', () => {
      beforeEach(() => useLayout(STATIC));

      it('chowns only the config dir and the log file', (done) => {
        preyUser.setup_permissions((err) => {
          expect(err).to.not.exist;
          expect(chownedPaths()).to.deep.equal(['/etc/prey', '/var/log/prey/prey.log']);
          done();
        });
      });

      it('never hands the root-owned package dir to the prey user', (done) => {
        preyUser.setup_permissions(() => {
          expect(chownedPaths()).to.not.include('/opt/prey');
          done();
        });
      });

      it('does not touch the package dir looking for a current symlink', (done) => {
        fsStub.readlinkSync.returns('/somewhere');
        fsStub.existsSync.returns(false);
        preyUser.setup_permissions(() => {
          expect(fsStub.unlinkSync.called).to.be.false;
          done();
        });
      });

      it('chowns to the prey user ids', (done) => {
        preyUser.setup_permissions(() => {
          expect(uidNumberStub.firstCall.args[0]).to.equal('prey');
          chownrStub.args.forEach((call) => {
            expect(call[1]).to.equal(990);
            expect(call[2]).to.equal(990);
          });
          done();
        });
      });
    });

    describe('versioned install', () => {
      beforeEach(() => useLayout(VERSIONED));

      it('chowns the install dir, config dir and log file (unchanged behaviour)', (done) => {
        preyUser.setup_permissions((err) => {
          expect(err).to.not.exist;
          expect(chownedPaths()).to.deep.equal([
            '/usr/lib/prey',
            '/etc/prey',
            '/var/log/prey/prey.log',
          ]);
          done();
        });
      });

      it('removes a dangling current symlink before chowning', (done) => {
        fsStub.readlinkSync.returns('/usr/lib/prey/versions/0.0.1');
        fsStub.existsSync.returns(false);
        preyUser.setup_permissions(() => {
          expect(fsStub.unlinkSync.calledOnceWith('/usr/lib/prey/current')).to.be.true;
          done();
        });
      });
    });

    it('tolerates an existing config dir', (done) => {
      useLayout(STATIC);
      fsStub.mkdir.callsFake((dir, cb) => cb(Object.assign(new Error('exists'), { code: 'EEXIST' })));
      preyUser.setup_permissions((err) => {
        expect(err).to.not.exist;
        expect(chownrStub.called).to.be.true;
        done();
      });
    });

    it('fails before chowning when the config dir cannot be created', (done) => {
      useLayout(STATIC);
      fsStub.mkdir.callsFake((dir, cb) => cb(Object.assign(new Error('denied'), { code: 'EACCES' })));
      preyUser.setup_permissions((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.code).to.equal('EACCES');
        expect(chownrStub.called).to.be.false;
        done();
      });
    });
  });

  describe('create (adapter path: create_user → setup_permissions → activate)', () => {
    it('keeps the package dir root-owned on a static install', (done) => {
      useLayout(STATIC);
      preyUser.create((err) => {
        expect(err).to.not.exist;
        expect(execStub.calledOnce).to.be.true;
        expect(chownedPaths()).to.deep.equal(['/etc/prey', '/var/log/prey/prey.log']);
        expect(ocelotStub.exec_as.calledOnceWith('prey', '/opt/prey/bin/prey config activate')).to.be.true;
        expect(execStub.calledBefore(chownrStub)).to.be.true;
        expect(chownrStub.calledBefore(ocelotStub.exec_as)).to.be.true;
        done();
      });
    });

    it('still chowns the install dir on a versioned install', (done) => {
      useLayout(VERSIONED);
      preyUser.create((err) => {
        expect(err).to.not.exist;
        expect(chownedPaths()[0]).to.equal('/usr/lib/prey');
        done();
      });
    });
  });
});
