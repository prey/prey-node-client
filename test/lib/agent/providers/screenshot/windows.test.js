/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
/* eslint-disable global-require */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

const windowsPath = '../../../../../lib/agent/providers/screenshot/windows/index';
const indexPath = '../../../../../lib/agent/providers/screenshot/index';

// Builds a fake fs where the screenshot file has the given mtime (or does not exist).
const fakeFs = ({ unlinkErr = null, mtimeMs = null } = {}) => ({
  unlink: sinon.stub().callsFake((file, cb) => cb(unlinkErr)),
  stat: sinon.stub().callsFake((file, cb) => {
    if (mtimeMs === null) {
      const err = new Error('ENOENT: no such file');
      err.code = 'ENOENT';
      return cb(err);
    }
    return cb(null, { mtimeMs });
  }),
});

// preyshot exits with code 1 even when the capture works, so the default fake
// reports that same error to make sure it is not treated as a failure.
const exitCodeOne = () => {
  const err = new Error('Command failed');
  err.code = 1;
  return err;
};

describe('Screenshot Windows Provider (OWCA-681)', () => {
  let provider;
  let runAsUser;

  beforeEach(() => {
    provider = rewire(windowsPath);
    runAsUser = sinon.stub().callsFake((bin, args, opts, cb) => cb(exitCodeOne()));
    provider.__set__('runAsUser', runAsUser);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('removes the previous file with fs.unlink, not with `del` through runAsUser', (done) => {
    const fs = fakeFs({ mtimeMs: Date.now() + 100 });
    provider.__set__('fs', fs);

    provider.get_screenshot(() => {
      expect(fs.unlink.calledOnce).to.be.true;
      expect(fs.unlink.firstCall.args[0]).to.match(/screenshot\.jpg$/);
      expect(runAsUser.calledOnce).to.be.true;
      expect(runAsUser.firstCall.args[0]).to.match(/preyshot\.exe$/);
      expect(runAsUser.firstCall.args[0]).to.not.match(/^del /);
      done();
    });
  });

  it('accepts a fresh file even when preyshot exits with code 1', (done) => {
    provider.__set__('fs', fakeFs({ mtimeMs: Date.now() + 100 }));

    provider.get_screenshot((err, file, type) => {
      expect(err).to.be.null;
      expect(file).to.match(/screenshot\.jpg$/);
      expect(type).to.equal('image/jpeg');
      done();
    });
  });

  it('rejects a stale file that preyshot could not overwrite', (done) => {
    // Left behind by a report sent 2 minutes earlier.
    provider.__set__('fs', fakeFs({ mtimeMs: Date.now() - 2 * 60 * 1000 }));

    provider.get_screenshot((err, file) => {
      expect(err).to.be.an('error');
      expect(err.message).to.match(/stale/);
      expect(file).to.be.undefined;
      done();
    });
  });

  it('accepts a file within the timestamp tolerance', (done) => {
    provider.__set__('fs', fakeFs({ mtimeMs: Date.now() - 500 }));

    provider.get_screenshot((err) => {
      expect(err).to.be.null;
      done();
    });
  });

  it('fails when preyshot did not generate any file', (done) => {
    provider.__set__('fs', fakeFs({ mtimeMs: null }));

    provider.get_screenshot((err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.match(/no file generated/);
      done();
    });
  });

  it('still runs preyshot when the previous file cannot be removed, and the mtime decides', (done) => {
    const busy = new Error('EBUSY: resource busy');
    busy.code = 'EBUSY';
    provider.__set__('fs', fakeFs({ unlinkErr: busy, mtimeMs: Date.now() - 10 * 60 * 1000 }));

    provider.get_screenshot((err) => {
      expect(runAsUser.calledOnce).to.be.true;
      expect(err).to.be.an('error');
      expect(err.message).to.match(/stale/);
      done();
    });
  });

  it('delivers a synchronous runAsUser throw as a callback error, never throwing', (done) => {
    provider.__set__('fs', fakeFs({ mtimeMs: Date.now() }));
    provider.__set__('runAsUser', () => { throw new Error('spawn EROFS'); });

    expect(() => {
      provider.get_screenshot((err) => {
        expect(err).to.be.an('error');
        expect(err.message).to.match(/EROFS/);
        done();
      });
    }).to.not.throw();
  });

  describe('through the screenshot/index.js adapter', () => {
    let index;

    beforeEach(() => {
      index = rewire(indexPath);
      index.__set__('osFunctions', provider);
      // The adapter checks existence and size of the file reported by the OS module.
      index.__set__('fs', {
        existsSync: () => true,
        statSync: () => ({ size: 1000 }),
      });
    });

    it('returns an error instead of the stale file', (done) => {
      provider.__set__('fs', fakeFs({ mtimeMs: Date.now() - 5 * 60 * 1000 }));

      index.get_screenshot((err, result) => {
        expect(err).to.be.an('error');
        expect(err.message).to.match(/stale/);
        expect(result).to.be.undefined;
        done();
      });
    });

    it('returns the file when the capture is fresh', (done) => {
      provider.__set__('fs', fakeFs({ mtimeMs: Date.now() + 100 }));

      index.get_screenshot((err, result) => {
        expect(err).to.be.null;
        expect(result.file).to.match(/screenshot\.jpg$/);
        expect(result.content_type).to.equal('image/jpeg');
        done();
      });
    });

    it('surfaces the error through providers.get', (done) => {
      provider.__set__('fs', fakeFs({ mtimeMs: Date.now() - 5 * 60 * 1000 }));

      const hooks = require('../../../../../lib/agent/hooks');
      sinon.stub(hooks, 'trigger');
      const providers = require('../../../../../lib/agent/providers');
      sinon.stub(providers, 'map').callsFake((cb) => cb(null, { screenshot: index.get_screenshot }));

      providers.get('screenshot', (err, result) => {
        expect(err).to.be.an('error');
        expect(err.message).to.match(/stale/);
        expect(result && result.file).to.be.undefined;
        done();
      });
    });
  });
});
