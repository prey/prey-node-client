/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const http = require('http');

describe('system/windows/winsvc', () => {
  let winsvc;
  let execStub;

  beforeEach(() => {
    winsvc = rewire('../../../../lib/system/windows/winsvc');
    execStub = sinon.stub();
    winsvc.__set__('exec', execStub);
    winsvc.__set__('paths', {
      install: String.raw`C:\Windows\Prey`,
      current: String.raw`C:\Windows\Prey\current`,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('get_version', () => {
    it('returns the trimmed version from the binary output', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, '2.0.35\r\n'));

      winsvc.get_version((err, version) => {
        expect(err == null).to.equal(true);
        expect(version).to.equal('2.0.35');
        done();
      });
    });

    it('reports unknown version instead of crashing when spawn throws synchronously (EROFS)', (done) => {
      execStub.callsFake(() => { throw new Error('spawn EROFS'); });

      winsvc.get_version((err, version) => {
        expect(err == null).to.equal(true);
        expect(version).to.equal(null);
        done();
      });
    });

    it('spawns with a safe cwd (Windows Temp)', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, '2.0.35\n'));

      winsvc.get_version(() => {
        const opts = execStub.firstCall.args[1];
        expect(opts).to.be.an('object');
        expect(opts.cwd.endsWith('Temp')).to.equal(true);
        done();
      });
    });
  });

  describe('supports', () => {
    it('is false when the version cannot be determined (spawn throw)', (done) => {
      execStub.callsFake(() => { throw new Error('spawn EROFS'); });

      winsvc.supports('2.0.34', (supported) => {
        expect(supported).to.equal(false);
        done();
      });
    });

    it('is true when the installed version meets the minimum', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, '2.0.35\n'));

      winsvc.supports('2.0.34', (supported) => {
        expect(supported).to.equal(true);
        done();
      });
    });

    it('is false when the installed version is older than the minimum', (done) => {
      execStub.callsFake((cmd, opts, cb) => cb(null, '2.0.33\n'));

      winsvc.supports('2.0.34', (supported) => {
        expect(supported).to.equal(false);
        done();
      });
    });
  });

  describe('request_action', () => {
    let server;
    let received;

    const listen = (handler) => new Promise((resolve) => {
      server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => { received = JSON.parse(body); handler(req, res); });
      });
      server.listen(0, '127.0.0.1', () => {
        winsvc.__set__('WINSVC_PORT', server.address().port);
        resolve();
      });
    });

    afterEach((done) => { if (server) server.close(() => done()); else done(); });

    it('posts the action with empty opts and returns the parsed envelope', async () => {
      await listen((req, res) => res.end('{"error":false,"output":{"error":false,"operation":{"id":"a","phase":"admitted"}}}'));
      const envelope = await new Promise((resolve, reject) => {
        winsvc.request_action('migrate', 2000, (err, body) => (err ? reject(err) : resolve(body)));
      });
      expect(received).to.deep.equal({ action: 'migrate', opts: {} });
      expect(envelope.output.operation.id).to.equal('a');
    });

    it('reports a non-200 status', async () => {
      await listen((req, res) => { res.statusCode = 403; res.end('{"error":true,"output":"forbidden"}'); });
      const err = await new Promise((resolve) => winsvc.request_action('migrate', 2000, resolve));
      expect(err.message).to.equal('winsvc_http_403');
    });

    it('reports an unparsable body', async () => {
      await listen((req, res) => res.end('nope'));
      const err = await new Promise((resolve) => winsvc.request_action('migrate-status', 2000, resolve));
      expect(err.message).to.equal('invalid_response');
    });

    it('times out with the caller deadline', async () => {
      await listen(() => {});
      const err = await new Promise((resolve) => winsvc.request_action('migrate', 100, resolve));
      expect(err.message).to.equal('timeout');
    });
  });
});
