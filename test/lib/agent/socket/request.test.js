/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */
const net = require('net');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { expect } = require('chai');
const rewire = require('rewire');

const startServer = (reply) => new Promise((resolve) => {
  const sockPath = path.join(os.tmpdir(), `prey-req-${process.pid}-${Date.now()}.sock`);
  const received = [];
  const server = net.createServer((conn) => {
    let buf = '';
    conn.on('data', (d) => {
      buf += d;
      if (buf.includes('\n')) {
        received.push(JSON.parse(buf.trim()));
        reply(conn);
      }
    });
  });
  server.listen(sockPath, () => resolve({ server, sockPath, received }));
});

describe('socket.request', () => {
  let socket;
  let srv;

  before(function skipOnWindows() {
    if (process.platform === 'win32') this.skip();
  });

  beforeEach(() => {
    socket = rewire('../../../../lib/agent/socket');
    socket.osName = 'mac';
    socket.__set__('getOwnerShip', (cb) => cb(null, ['srw-rw----', '1', 'prey']));
  });

  afterEach((done) => {
    if (!srv) return done();
    const { server, sockPath } = srv;
    srv = null;
    return server.close(() => { fs.rmSync(sockPath, { force: true }); done(); });
  });

  const use = async (reply) => {
    srv = await startServer(reply);
    socket.__set__('socketFile', srv.sockPath);
    return srv;
  };

  it('sends the fixed message and joins a response split across chunks', async () => {
    const response = {
      name: 'migrate', function: 'migrate', success: true, output: { result: { error: false } },
    };
    const line = `${JSON.stringify(response)}\n`;
    const { received } = await use((conn) => {
      conn.write(line.slice(0, 10));
      setTimeout(() => conn.end(line.slice(10)), 20);
    });
    const got = await new Promise((resolve, reject) => {
      socket.request('migrate-migrate', 2000, (err, r) => (err ? reject(err) : resolve(r)));
    });
    expect(received).to.deep.equal([{ name: 'migrate', function: 'migrate' }]);
    expect(got).to.deep.equal(response);
  });

  it('times out when no full line arrives', async () => {
    await use(() => {});
    const err = await new Promise((resolve) => { socket.request('migrate-status', 100, resolve); });
    expect(err.message).to.equal('timeout');
  });

  it('rejects an invalid response', async () => {
    await use((conn) => conn.end('{"nope":true}\n'));
    const err = await new Promise((resolve) => { socket.request('migrate-status', 2000, resolve); });
    expect(err.message).to.equal('invalid_response');
  });

  it('rejects a null response line', async () => {
    await use((conn) => conn.end('null\n'));
    const err = await new Promise((resolve) => { socket.request('migrate-status', 2000, resolve); });
    expect(err.message).to.equal('invalid_response');
  });

  it('refuses a socket not owned by prey', async () => {
    await use(() => {});
    socket.__set__('getOwnerShip', (cb) => cb(null, ['srw-rw----', '1', 'root']));
    const err = await new Promise((resolve) => { socket.request('migrate-status', 2000, resolve); });
    expect(err.message).to.equal('socket_not_owned');
  });

  it('fails fast for a missing socket, an unknown message or another platform', (done) => {
    socket.__set__('socketFile', path.join(os.tmpdir(), 'prey-req-missing.sock'));
    socket.request('migrate-status', 2000, (err1) => {
      expect(err1.message).to.equal('socket_missing');
      socket.request('nope', 2000, (err2) => {
        expect(err2.message).to.equal('unknown_message');
        socket.osName = 'windows';
        socket.request('migrate-status', 2000, (err3) => {
          expect(err3.message).to.equal('unsupported_platform');
          done();
        });
      });
    });
  });
});
