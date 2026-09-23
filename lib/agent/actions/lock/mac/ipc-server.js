// @ts-check

/*
 * Prey Lock IPC server (macOS)
 *
 * Prey.app's LockIPC is a *client*: it connects once to the path given via
 * -socket and never retries, so the listener has to be up before the app is
 * spawned. One server per spawn; it stops accepting after the first connection.
 */

const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const common = require('../../../common');

const logger = common.logger.prefix('lock-ipc');

// Not os.tmpdir(): on macOS that is the caller's private $TMPDIR, which the
// logged-in user cannot reach. The socket has to sit somewhere both the agent
// (running as `prey`) and the logged user can see.
const tmpDir = (common.system.paths && common.system.paths.temp) || '/tmp';

const DIR_PREFIX = 'prey-lock-';
const STALE_MS = 6 * 60 * 60 * 1000;
const MAX_BUFFER = 64 * 1024;

/** @param {string} target */
const rm = (target) => {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (e) { /* best effort */ }
};

/**
 * Left-over dirs from an agent that was SIGKILLed mid-lock. A live socket dir
 * is always younger than STALE_MS, and dirs owned by someone else throw.
 *
 * @returns {void}
 */
const sweep = () => {
  let entries;
  try {
    entries = fs.readdirSync(tmpDir);
  } catch (e) {
    return;
  }

  const now = Date.now();
  entries
    .filter((entry) => entry.indexOf(DIR_PREFIX) === 0)
    .forEach((entry) => {
      const dir = path.join(tmpDir, entry);
      try {
        if (now - fs.statSync(dir).mtimeMs > STALE_MS) rm(dir);
      } catch (e) { /* not ours, or already gone */ }
    });
};

/**
 * What createServer() hands back: an EventEmitter carrying the socket path,
 * the live connection state, and the two control methods. Emits 'connect'
 * once Prey.app is in, and 'event' for every {"event": ...} object it sends.
 *
 * @typedef {EventEmitter & {
 *   path: string,
 *   connected: boolean,
 *   send: (obj: object) => boolean,
 *   close: () => void,
 * }} LockIpcHandle
 */

/**
 * Brings up the listener Prey.app connects back to. One server per spawn.
 *
 * @param {(err: Error|null, handle?: LockIpcHandle) => void} cb
 * @returns {LockIpcHandle|null} null only when the socket dir cannot be made
 */
const createServer = (cb) => {
  let dir;
  try {
    dir = fs.mkdtempSync(path.join(tmpDir, DIR_PREFIX));
    // /tmp is world-listable, so the random dir name is not a secret: any local
    // user can `ls /tmp` and see it. The secret is the socket *name*, which is
    // random per spawn. o+x lets the logged user traverse in to a name it was
    // handed via -socket; no o+r means no other account can list the dir to
    // discover that name.
    fs.chmodSync(dir, 0o711);
  } catch (e) {
    cb(e);
    return null;
  }

  const sockName = `${crypto.randomBytes(9).toString('hex')}.sock`;
  const sockPath = path.join(dir, sockName);
  const handle = /** @type {LockIpcHandle} */ (new EventEmitter());
  const server = net.createServer();

  let conn = null;
  let settled = false;
  let closed = false;

  handle.path = sockPath;
  handle.connected = false;

  handle.send = (obj) => {
    if (!conn || !handle.connected) return false;
    try {
      conn.write(`${JSON.stringify(obj)}\n`);
      return true;
    } catch (e) {
      return false;
    }
  };

  const onExit = () => handle.close();

  handle.close = () => {
    if (closed) return;
    closed = true;
    handle.connected = false;
    process.removeListener('exit', onExit);

    if (conn) {
      conn.removeAllListeners();
      try {
        conn.destroy();
      } catch (e) { /* already gone */ }
      conn = null;
    }

    try {
      server.close();
    } catch (e) { /* never listened */ }

    rm(dir);
  };

  process.once('exit', onExit);

  /** @param {Error|null} err */
  const settle = (err) => {
    if (settled) return;
    settled = true;

    if (err) {
      handle.close();
      cb(err);
      return;
    }
    cb(null, handle);
  };

  /** @param {import('net').Socket} socket */
  const readLines = (socket) => {
    let buf = '';
    socket.setEncoding('utf8');

    socket.on('data', (chunk) => {
      buf += chunk;

      let i = buf.indexOf('\n');
      while (i !== -1) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);

        if (line) {
          let msg = null;
          try {
            msg = JSON.parse(line);
          } catch (e) {
            logger.debug('discarding malformed line');
          }
          if (msg && msg.event) handle.emit('event', msg);
        }
        i = buf.indexOf('\n');
      }

      if (buf.length > MAX_BUFFER) buf = ''; // don't grow on a garbage peer
    });
  };

  server.on('connection', (socket) => {
    if (conn) {
      socket.destroy(); // only one Prey.app per server
      return;
    }

    conn = socket;
    handle.connected = true;

    // Stop listening the moment Prey.app is in: no window for another local
    // user to connect and inject events, and the path stops resolving.
    try {
      server.close();
    } catch (e) { /* ignore */ }
    try {
      fs.unlinkSync(sockPath);
    } catch (e) { /* ignore */ }

    readLines(socket);

    // A dead socket is not a dead lock: the exit code is the only authority.
    const drop = () => { handle.connected = false; };
    socket.on('close', drop);
    socket.on('error', drop);

    handle.emit('connect');
  });

  server.on('error', (err) => {
    if (settled) {
      logger.debug(`ipc server error: ${err.message}`);
      handle.close();
      return;
    }
    settle(err);
  });

  server.listen(sockPath, () => {
    try {
      // The agent runs as `prey` while Prey.app runs as the logged user, and
      // connect() needs write permission on the socket. `prey` is not root so
      // it cannot chown it to that user — world-writable is the only option.
      // World-writable is safe here only because the socket name is random and
      // sits in a 0711 (non-listable) dir: another account cannot discover the
      // full path to connect to, and macOS does not leak it via `ps` argv
      // (KERN_PROCARGS2 is UID-restricted for non-root callers).
      fs.chmodSync(sockPath, 0o777);
    } catch (e) {
      settle(e);
      return;
    }
    settle(null);
  });

  return handle;
};

exports.createServer = createServer;
exports.sweep = sweep;
