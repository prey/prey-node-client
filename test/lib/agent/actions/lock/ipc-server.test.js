/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const fs = require('fs');
const net = require('net');
const path = require('path');

const { expect } = chai;

const ipcServer = require('../../../../../lib/agent/actions/lock/mac/ipc-server');

// Unix domain sockets and /tmp are POSIX-only; these run on CI (Linux/Mac).
const describeUnix = process.platform === 'win32' ? describe.skip : describe;

describeUnix('lock ipc-server', () => {
  let handle;

  afterEach(() => {
    if (handle) handle.close();
    handle = null;
  });

  function start() {
    return new Promise((resolve, reject) => {
      ipcServer.createServer((err, h) => {
        if (err) return reject(err);
        handle = h;
        return resolve(h);
      });
    });
  }

  // Prey.app connects as the logged-in user while the agent listens as `prey`,
  // which is unprivileged and therefore cannot chown the socket.
  describe('socket permissions', () => {
    it('creates a world-writable socket inside a non-listable directory', async () => {
      const h = await start();
      const dir = path.dirname(h.path);

      expect(fs.statSync(h.path).mode & 0o777).to.equal(0o777);
      expect(fs.statSync(dir).mode & 0o777).to.equal(0o711);
    });

    it('gives every server an unguessable path of its own', async () => {
      const first = await start();
      const firstPath = first.path;
      const firstSock = path.basename(first.path);
      first.close();

      const second = await start();

      expect(second.path).to.not.equal(firstPath);
      expect(path.basename(path.dirname(second.path))).to.match(/^prey-lock-/);

      // The socket name is the secret, not the (world-listable) dir name, so it
      // must be random per spawn — never a fixed constant like the old 'l.sock'.
      const secondSock = path.basename(second.path);
      expect(secondSock).to.not.equal('l.sock');
      expect(secondSock).to.not.equal(firstSock);
      expect(secondSock).to.match(/^[0-9a-f]+\.sock$/);
    });
  });

  describe('connection handling', () => {
    it('stops listening once the lock is in', async () => {
      const h = await start();

      await new Promise((resolve) => {
        h.once('connect', resolve);
        net.connect(h.path);
      });

      // no window for another local user to connect and inject events
      expect(h.connected).to.be.true;
      expect(fs.existsSync(h.path)).to.be.false;
    });

    it('marks itself disconnected when the lock goes away', async () => {
      const h = await start();

      const client = net.connect(h.path);
      await new Promise((resolve) => h.once('connect', resolve));

      await new Promise((resolve) => {
        client.on('close', () => setTimeout(resolve, 20));
        client.destroy();
      });

      expect(h.connected).to.be.false;
    });

    it('sends commands to the connected lock', async () => {
      const h = await start();

      const client = net.connect(h.path);
      await new Promise((resolve) => h.once('connect', resolve));

      const received = await new Promise((resolve) => {
        client.once('data', (d) => resolve(d.toString()));
        h.send({ cmd: 'unlock' });
      });

      expect(received).to.equal('{"cmd":"unlock"}\n');
      client.destroy();
    });

    it('removes its directory on close', async () => {
      const h = await start();
      const dir = path.dirname(h.path);

      h.close();

      expect(fs.existsSync(dir)).to.be.false;
    });
  });

  describe('event parsing', () => {
    async function feed(chunks) {
      const h = await start();
      const client = net.connect(h.path);
      await new Promise((resolve) => h.once('connect', resolve));

      const events = [];
      h.on('event', (msg) => events.push(msg));

      // eslint-disable-next-line no-restricted-syntax
      for (const chunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => client.write(chunk, resolve));
      }
      await new Promise((resolve) => setTimeout(resolve, 30));

      client.destroy();
      return events;
    }

    it('parses several events arriving in one chunk', async () => {
      const events = await feed([
        '{"event":"failed_unlock_attempt"}\n{"event":"status","locked":true}\n',
      ]);

      expect(events).to.have.lengthOf(2);
      expect(events[0].event).to.equal('failed_unlock_attempt');
      expect(events[1]).to.deep.equal({ event: 'status', locked: true });
    });

    it('parses an event split across chunks', async () => {
      const events = await feed(['{"event":"fail', 'ed_unlock_', 'attempt"}\n']);

      expect(events).to.have.lengthOf(1);
      expect(events[0].event).to.equal('failed_unlock_attempt');
    });

    it('holds back a trailing partial line', async () => {
      const events = await feed(['{"event":"unlock_success"}\n{"event":"sta']);

      expect(events).to.have.lengthOf(1);
      expect(events[0].event).to.equal('unlock_success');
    });

    it('skips a malformed line without losing the ones around it', async () => {
      const events = await feed([
        '{"event":"unlock_success"}\nnot json at all\n{"event":"failed_unlock_attempt"}\n',
      ]);

      expect(events.map((e) => e.event))
        .to.deep.equal(['unlock_success', 'failed_unlock_attempt']);
    });

    it('ignores well-formed JSON that carries no event', async () => {
      const events = await feed(['{"hello":"world"}\n[1,2,3]\n"bare string"\n']);

      expect(events).to.be.empty;
    });
  });

  describe('sweep', () => {
    it('removes leftover directories but keeps live ones', () => {
      const stale = fs.mkdtempSync('/tmp/prey-lock-');
      const fresh = fs.mkdtempSync('/tmp/prey-lock-');
      const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
      fs.utimesSync(stale, old, old);

      try {
        ipcServer.sweep();

        expect(fs.existsSync(stale)).to.be.false;
        expect(fs.existsSync(fresh)).to.be.true;
      } finally {
        fs.rmSync(stale, { recursive: true, force: true });
        fs.rmSync(fresh, { recursive: true, force: true });
      }
    });
  });
});
