/* eslint-disable no-unused-expressions */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('lib/package - releases.download (atomic download)', () => {
  let packageMod;
  let releases;
  let tmp;
  let needleGet;
  const URL = 'https://downloads.example.com/prey-mac-1.13.42-arm64.zip';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prey-dl-test-'));
    packageMod = rewire('../../lib/package');
    packageMod.__set__('tmpdir', tmp);
    packageMod.__set__('log', () => {});
    releases = packageMod.__get__('releases');
    needleGet = sinon.stub();
    packageMod.__set__('needle', { get: needleGet });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    sinon.restore();
  });

  const finalFile = () => path.join(tmp, 'prey-mac-1.13.42-arm64.zip');

  it('downloads into a .part file and renames it once complete', (done) => {
    needleGet.callsFake((url, opts, cb) => {
      expect(opts.output).to.equal(`${finalFile()}.part`);
      fs.writeFileSync(opts.output, 'zip-bytes');
      cb(null, { statusCode: 200 }, null);
    });

    releases.download(URL, (err, file) => {
      expect(err).to.equal(null);
      expect(file).to.equal(finalFile());
      expect(fs.readFileSync(file, 'utf8')).to.equal('zip-bytes');
      expect(fs.existsSync(`${finalFile()}.part`)).to.equal(false);
      done();
    });
  });

  it('leaves no package behind when the transfer is interrupted', (done) => {
    needleGet.callsFake((url, opts, cb) => {
      fs.writeFileSync(opts.output, 'half-a-zip');
      cb(new Error('socket hang up'));
    });

    releases.download(URL, (err) => {
      expect(err).to.be.an('error');
      expect(fs.existsSync(finalFile())).to.equal(false);
      expect(fs.existsSync(`${finalFile()}.part`)).to.equal(false);
      done();
    });
  });

  it('removes the partial file on an unexpected status code', (done) => {
    needleGet.callsFake((url, opts, cb) => {
      fs.writeFileSync(opts.output, 'not found page');
      cb(null, { statusCode: 404 }, Buffer.from('not found'));
    });

    releases.download(URL, (err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.contain('Unexpected response');
      expect(fs.existsSync(finalFile())).to.equal(false);
      expect(fs.existsSync(`${finalFile()}.part`)).to.equal(false);
      done();
    });
  });

  it('does not treat a leftover .part file as an already downloaded package', (done) => {
    fs.writeFileSync(`${finalFile()}.part`, 'stale');
    needleGet.callsFake((url, opts, cb) => {
      // the stale part must be gone before the new transfer starts
      expect(fs.existsSync(opts.output)).to.equal(false);
      fs.writeFileSync(opts.output, 'fresh');
      cb(null, { statusCode: 200 }, null);
    });

    releases.download(URL, (err, file) => {
      expect(err).to.equal(null);
      expect(needleGet.calledOnce).to.equal(true);
      expect(fs.readFileSync(file, 'utf8')).to.equal('fresh');
      done();
    });
  });

  it('reuses a complete package without downloading again', (done) => {
    fs.writeFileSync(finalFile(), 'complete');

    releases.download(URL, (err, file) => {
      expect(err).to.equal(null);
      expect(file).to.equal(finalFile());
      expect(needleGet.called).to.equal(false);
      done();
    });
  });
});

describe('lib/package - upgrade failure record', () => {
  let pkg;
  let storageDo;
  let rows;

  beforeEach(() => {
    pkg = rewire('../../lib/package');
    rows = {};
    storageDo = sinon.stub().callsFake((perform, opts, cb) => {
      if (perform === 'set') { rows[opts.id] = opts.data.value; return cb(null); }
      if (perform === 'query') return cb(null, rows[opts.data] !== undefined ? [{ id: opts.data, value: rows[opts.data] }] : []);
      if (perform === 'del') { delete rows[opts.id]; return cb(null); }
      if (perform === 'clear') return cb(null);
      if (perform === 'all') return cb(null, []);
      return cb(null);
    });
    pkg.__set__('storage', { do: storageDo });
  });

  afterEach(() => sinon.restore());

  it('saves and reads back a failure', (done) => {
    pkg.save_upgrade_failure({
      version: '1.13.42', from: '1.13.41', code: 1, message: 'boom',
    }, (err) => {
      expect(err).to.equal(null);
      pkg.get_upgrade_failure((err2, failure) => {
        expect(err2).to.equal(null);
        expect(failure.version).to.equal('1.13.42');
        expect(failure.from).to.equal('1.13.41');
        expect(failure.code).to.equal(1);
        expect(failure.message).to.equal('boom');
        expect(Number.isFinite(failure.at)).to.equal(true);
        done();
      });
    });
  });

  it('strips single quotes so the raw SQL interpolation does not break', (done) => {
    pkg.save_upgrade_failure({
      version: '1.13.42', from: '1.13.41', code: 1, message: "can't chmod",
    }, () => {
      expect(rows[pkg.UPGRADE_FAILURE_KEY]).to.not.contain("'");
      done();
    });
  });

  it('returns null for a corrupt stored value', (done) => {
    rows[pkg.UPGRADE_FAILURE_KEY] = '{not json';
    pkg.get_upgrade_failure((err, failure) => {
      expect(err).to.equal(null);
      expect(failure).to.equal(null);
      done();
    });
  });

  it('returns null when the record has no valid timestamp', (done) => {
    rows[pkg.UPGRADE_FAILURE_KEY] = JSON.stringify({ version: '1.13.42', at: 'yesterday' });
    pkg.get_upgrade_failure((err, failure) => {
      expect(failure).to.equal(null);
      done();
    });
  });

  it('clear_upgrade_failure removes the record', (done) => {
    pkg.save_upgrade_failure({
      version: '1.13.42', from: '1.13.41', code: 1, message: 'x',
    }, () => {
      pkg.clear_upgrade_failure(() => {
        pkg.get_upgrade_failure((err, failure) => {
          expect(failure).to.equal(null);
          done();
        });
      });
    });
  });

  it('delete_attempts (reset command) also clears the failure record', (done) => {
    rows[pkg.UPGRADE_FAILURE_KEY] = JSON.stringify({ version: '1.13.42', at: Date.now() });
    pkg.delete_attempts(() => {
      expect(rows[pkg.UPGRADE_FAILURE_KEY]).to.equal(undefined);
      done();
    });
  });

  it('check_update_success clears the failure record once the failed version is running', (done) => {
    rows[pkg.UPGRADE_FAILURE_KEY] = JSON.stringify({ version: '1.13.42', at: Date.now() });
    pkg.check_update_success('1.13.42', '/versions', () => {
      expect(rows[pkg.UPGRADE_FAILURE_KEY]).to.equal(undefined);
      done();
    });
  });

  it('check_update_success keeps the failure record while still on the old version', (done) => {
    // e.g. the version check failed (offline) on the boot after a failed activation
    rows[pkg.UPGRADE_FAILURE_KEY] = JSON.stringify({ version: '1.13.42', at: Date.now() });
    pkg.check_update_success('1.13.41', '/versions', () => {
      expect(rows[pkg.UPGRADE_FAILURE_KEY]).to.not.equal(undefined);
      done();
    });
  });

  it('check_update_success still completes when reading the failure record errors out', (done) => {
    storageDo.withArgs('query').callsFake((perform, opts, cb) => cb(new Error('db locked')));
    pkg.check_update_success('1.13.42', '/versions', (err) => {
      expect(err).to.equal(undefined);
      expect(storageDo.calledWith('del')).to.equal(false);
      done();
    });
  });

  it('get_version reports the stored activation error for the same version', (done) => {
    rows[pkg.UPGRADE_FAILURE_KEY] = JSON.stringify({ version: '1.13.42', at: Date.now(), message: 'chmodr EPERM' });
    const attempt = sinon.stub(pkg, 'update_version_attempt').callsFake((from, to, plus, notified, error, cb) => cb(null, false));

    pkg.get_version('1.13.42', '/versions', () => {
      expect(attempt.calledOnce).to.equal(true);
      expect(attempt.firstCall.args[4]).to.equal('chmodr EPERM');
      done();
    });
  });

  it('get_version keeps the generic message when the failure belongs to another version', (done) => {
    rows[pkg.UPGRADE_FAILURE_KEY] = JSON.stringify({ version: '1.13.40', at: Date.now(), message: 'old' });
    const attempt = sinon.stub(pkg, 'update_version_attempt').callsFake((from, to, plus, notified, error, cb) => cb(null, false));

    pkg.get_version('1.13.42', '/versions', () => {
      expect(attempt.firstCall.args[4]).to.equal('Failed previous attempt');
      done();
    });
  });
});
