/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

const { expect } = chai;

describe('mdm_enroll', () => {
  let mdmEnrollRewired;
  let needleMock;

  beforeEach(() => {
    needleMock = {
      post: sinon.stub(),
    };

    mdmEnrollRewired = rewire('../../../../../lib/agent/actions/mdm_enroll');
    mdmEnrollRewired.__set__('needle', needleMock);
    mdmEnrollRewired.__set__('osName', 'windows');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('start', () => {
    it('should return error on MacOS platforms', (done) => {
      mdmEnrollRewired.__set__('osName', 'mac');

      const opts = {
        upn: 'admin@contoso.com',
        secret: 'SuperSecret',
        discovery_url: 'https://enrollment.contoso.com/Discovery.svc',
      };

      mdmEnrollRewired.start('test-id', opts, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('only allowed on Windows');
        done();
      });
    });

    it('should return error on linux platforms', (done) => {
      mdmEnrollRewired.__set__('osName', 'linux');

      const opts = {
        upn: 'admin@contoso.com',
        secret: 'SuperSecret',
        discovery_url: 'https://enrollment.contoso.com/Discovery.svc',
      };

      mdmEnrollRewired.start('test-id', opts, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('only allowed on Windows');
        done();
      });
    });

    it('should return error when upn is missing', (done) => {
      const opts = { secret: 'secret', discovery_url: 'https://example.com' };

      mdmEnrollRewired.start('test-id', opts, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('upn');
        done();
      });
    });

    it('should return error when secret is missing', (done) => {
      const opts = { upn: 'admin@contoso.com', discovery_url: 'https://example.com' };

      mdmEnrollRewired.start('test-id', opts, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('secret');
        done();
      });
    });

    it('should return error when discovery_url is missing', (done) => {
      const opts = { upn: 'admin@contoso.com', secret: 'secret' };

      mdmEnrollRewired.start('test-id', opts, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('discovery_url');
        done();
      });
    });

    it('should return error when opts is null', (done) => {
      mdmEnrollRewired.start('test-id', null, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        done();
      });
    });

    it('should POST to localhost:7739/action with correct payload', (done) => {
      const opts = {
        upn: 'admin@contoso.com',
        secret: 'SuperSecret',
        discovery_url: 'https://enrollment.contoso.com/Discovery.svc',
      };

      needleMock.post.callsFake((url, data, options, cb) => {
        cb(null, { statusCode: 200, body: { success: true } });
      });

      mdmEnrollRewired.start('test-id', opts, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.not.be.null;
      });

      // Allow the needle.post call to execute
      process.nextTick(() => {
        expect(needleMock.post.calledOnce).to.be.true;

        const [url, payload, reqOpts] = needleMock.post.firstCall.args;
        expect(url).to.equal('http://localhost:7739/action');
        expect(payload).to.deep.equal({
          action: 'mdm-enroll',
          opts: {
            upn: 'admin@contoso.com',
            secret: 'SuperSecret',
            discovery_url: 'https://enrollment.contoso.com/Discovery.svc',
          },
        });
        expect(reqOpts.json).to.be.true;
        done();
      });
    });

    it('should emit end on successful response', (done) => {
      const opts = {
        upn: 'admin@contoso.com',
        secret: 'SuperSecret',
        discovery_url: 'https://enrollment.contoso.com/Discovery.svc',
      };

      needleMock.post.callsFake((url, data, options, cb) => {
        cb(null, { statusCode: 200, body: { enrolled: true } });
      });

      mdmEnrollRewired.start('test-id', opts, (err, emitter) => {
        expect(err).to.be.null;

        emitter.on('end', (id, error, out) => {
          expect(id).to.equal('test-id');
          expect(error).to.be.null;
          expect(out).to.deep.equal({ enrolled: true });
          done();
        });
      });
    });

    it('should emit end with error on network failure', (done) => {
      const opts = {
        upn: 'admin@contoso.com',
        secret: 'SuperSecret',
        discovery_url: 'https://enrollment.contoso.com/Discovery.svc',
      };

      needleMock.post.callsFake((url, data, options, cb) => {
        cb(new Error('ECONNREFUSED'));
      });

      mdmEnrollRewired.start('test-id', opts, (err, emitter) => {
        expect(err).to.be.null;

        emitter.on('end', (id, error) => {
          expect(id).to.equal('test-id');
          expect(error).to.be.an.instanceOf(Error);
          expect(error.message).to.include('ECONNREFUSED');
          done();
        });
      });
    });

    it('should emit end with error on non-2xx status code', (done) => {
      const opts = {
        upn: 'admin@contoso.com',
        secret: 'SuperSecret',
        discovery_url: 'https://enrollment.contoso.com/Discovery.svc',
      };

      needleMock.post.callsFake((url, data, options, cb) => {
        cb(null, { statusCode: 500, body: { error: 'Internal Server Error' } });
      });

      mdmEnrollRewired.start('test-id', opts, (err, emitter) => {
        expect(err).to.be.null;

        emitter.on('end', (id, error) => {
          expect(id).to.equal('test-id');
          expect(error).to.be.an.instanceOf(Error);
          expect(error.message).to.include('500');
          done();
        });
      });
    });

    it('should pass upn through to the payload', (done) => {
      const opts = {
        upn: 'user@example.com',
        secret: 'my-secret',
        discovery_url: 'https://mdm.example.com/discovery',
      };

      needleMock.post.callsFake((url, data, options, cb) => {
        cb(null, { statusCode: 200, body: {} });
      });

      mdmEnrollRewired.start('test-id', opts, () => {});

      process.nextTick(() => {
        const payload = needleMock.post.firstCall.args[1];
        expect(payload.opts.upn).to.equal('user@example.com');
        expect(payload.opts).to.not.have.property('identifier');
        done();
      });
    });

    it('should accept nested opts.opts form from the loader', (done) => {
      const opts = {
        opts: {
          upn: 'nested@contoso.com',
          secret: 'nested-secret',
          discovery_url: 'https://nested.contoso.com/Discovery.svc',
        },
      };

      needleMock.post.callsFake((url, data, options, cb) => {
        cb(null, { statusCode: 200, body: { enrolled: true } });
      });

      mdmEnrollRewired.start('test-id', opts, (err, emitter) => {
        expect(err).to.be.null;
        emitter.on('end', (id, error, out) => {
          expect(id).to.equal('test-id');
          expect(error).to.be.null;
          expect(out).to.deep.equal({ enrolled: true });
          done();
        });
      });

      process.nextTick(() => {
        expect(needleMock.post.calledOnce).to.be.true;
        const payload = needleMock.post.firstCall.args[1];
        expect(payload.opts.upn).to.equal('nested@contoso.com');
        expect(payload.opts.secret).to.equal('nested-secret');
        expect(payload.opts.discovery_url).to.equal('https://nested.contoso.com/Discovery.svc');
      });
    });
  });

  describe('stop', () => {
    it('should not throw when called', () => {
      expect(() => mdmEnrollRewired.stop()).to.not.throw();
    });
  });
});
