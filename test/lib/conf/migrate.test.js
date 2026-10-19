/* eslint-disable no-unused-expressions */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const path = require('path');

describe('conf/migrate', () => {
  let migrate;
  let fsFake;
  let databaseFake;
  let sharedLogStub;
  let originalPlatform;
  let originalWindir;

  const WINDIR = path.join('fakewin');
  const legacyDir = path.join(WINDIR, 'Prey');
  const installDir = path.join('custom', 'Prey');

  const presentFiles = ['commands.db', 'prey.conf', 'prey.log', 'prey.log.1.gz'];

  const forceWindows = () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  };

  beforeEach(() => {
    originalPlatform = process.platform;
    originalWindir = process.env.WINDIR;
    process.env.WINDIR = WINDIR;
    forceWindows();

    migrate = rewire('../../../lib/conf/migrate');

    sharedLogStub = sinon.stub();
    migrate.__set__('shared', { log: sharedLogStub });
    migrate.__set__('paths', { install: installDir });

    fsFake = {
      existsSync: sinon.stub().callsFake((p) => {
        if (p === legacyDir) return true;
        return presentFiles.includes(path.basename(p));
      }),
      readdirSync: sinon.stub().returns([
        'commands.db', 'prey.conf', 'prey.log', 'prey_restarts.log',
        'prey.log.1.gz', 'prey.log.2.gz', 'random.txt',
      ]),
      mkdir: sinon.stub().callsFake((dir, opts, cb) => cb(null)),
      copyFile: sinon.stub().callsFake((src, dest, cb) => cb(null)),
      rm: sinon.stub().callsFake((p, opts, cb) => cb(null)),
      rename: sinon.stub().callsFake((from, to, cb) => cb(null)),
    };
    migrate.__set__('fs', fsFake);

    const fakeDb = { close: sinon.stub().callsFake((c) => typeof c === 'function' && c()) };
    databaseFake = {
      createDatabase: sinon.stub().callsFake((p, cb) => cb(null, fakeDb)),
      backupDatabase: sinon.stub().callsFake((db, dest, cb) => cb({ handle: true })),
      stepDatabase: sinon.stub().callsFake((handle, cb) => cb(null)),
      closeDatabase: sinon.stub().callsFake((handle, db, cb) => cb(null)),
      verifyDatabase: sinon.stub().callsFake((p, cb) => cb(null)),
    };
    migrate.__set__('database', databaseFake);
  });

  afterEach(() => {
    sinon.restore();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    if (originalWindir === undefined) delete process.env.WINDIR;
    else process.env.WINDIR = originalWindir;
  });

  it('copies present data files to the install dir (copy-only, originals untouched)', (done) => {
    migrate.files({}, (err, msg) => {
      expect(err).to.be.null;
      // commands.db goes through the sqlite backup API.
      expect(databaseFake.createDatabase.calledOnce).to.be.true;
      expect(databaseFake.createDatabase.firstCall.args[0]).to.equal(path.join(legacyDir, 'commands.db'));
      // prey.conf, prey.log and the one present rotated log are plain copies (3).
      expect(fsFake.copyFile.callCount).to.equal(3);
      // Copy-only: originals are NEVER renamed/removed, so a downgrade still finds them.
      expect(fsFake.rename.called).to.be.false;
      // The copied DB is verified before success.
      expect(databaseFake.verifyDatabase.calledOnce).to.be.true;
      expect(databaseFake.verifyDatabase.firstCall.args[0]).to.equal(path.join(installDir, 'commands.db'));
      expect(msg).to.contain('Migrated 4');
      done();
    });
  });

  it('fails and removes the copied DB when post-copy verification fails', (done) => {
    databaseFake.verifyDatabase.callsFake((p, cb) => cb(new Error('integrity_check failed: corrupt')));
    migrate.files({}, (err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.match(/integrity_check/);
      // The invalid copy is removed so it is not adopted on the next boot.
      const rmCall = fsFake.rm.getCalls().find((c) => c.args[0] === path.join(installDir, 'commands.db'));
      expect(rmCall, 'expected the copied DB to be removed').to.not.be.undefined;
      // Originals untouched.
      expect(fsFake.rename.called).to.be.false;
      done();
    });
  });

  it('is a no-op when the install dir equals the legacy dir', (done) => {
    migrate.__set__('paths', { install: legacyDir });
    migrate.files({}, (err, msg) => {
      expect(err).to.be.null;
      expect(msg).to.equal('Nothing to migrate');
      expect(fsFake.copyFile.called).to.be.false;
      expect(databaseFake.createDatabase.called).to.be.false;
      done();
    });
  });

  it('is a no-op when no data files are present in the legacy dir', (done) => {
    fsFake.existsSync.callsFake((p) => p === legacyDir);
    fsFake.readdirSync.returns([]);
    migrate.files({}, (err, msg) => {
      expect(err).to.be.null;
      expect(msg).to.equal('Nothing to migrate');
      expect(fsFake.rename.called).to.be.false;
      done();
    });
  });

  it('does nothing on non-Windows platforms', (done) => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    migrate.files({}, (err, msg) => {
      expect(err).to.be.null;
      expect(msg).to.equal('Only available on Windows');
      expect(fsFake.copyFile.called).to.be.false;
      done();
    });
  });

  it('aborts without touching originals if a copy fails', (done) => {
    databaseFake.createDatabase.callsFake((p, cb) => cb(new Error('db open failed')));
    migrate.files({}, (err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.equal('db open failed');
      expect(fsFake.rename.called).to.be.false;
      done();
    });
  });

  it('works when invoked through the CLI run() adapter shape (values, cb)', (done) => {
    // The CLI registers it via run(cmd, migrate.files), which calls
    // migrate.files(values, cb). Exercise that exact arity/shape.
    const values = { positional: [] };
    const command = migrate.files;
    command(values, (err, msg) => {
      expect(err).to.be.null;
      expect(msg).to.contain('Migrated');
      done();
    });
  });
});
