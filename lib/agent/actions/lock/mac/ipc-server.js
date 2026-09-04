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
const { EventEmitter } = require('events');

const common = require('../../../common');

const logger = common.logger.prefix('lock-ipc');

// Not os.tmpdir(): on macOS that is the caller's private $TMPDIR, which the
// logged-in user cannot reach. The socket has to sit somewhere both the agent
// (running as `prey`) and the logged user can see.
const tmpDir = (common.system.paths && common.system.paths.temp) || '/tmp';

const DIR_PREFIX = 'prey-lock-';
const SOCKET_NAME = 'l.sock';
const STALE_MS = 6 * 60 * 60 * 1000;
const MAX_BUFFER = 64 * 1024;

const rm = (target) => {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (e) { /* best effort */ }
};

// Left-over dirs from an agent that was SIGKILLed mid-lock. A live socket dir
// is always younger than STALE_MS, and dirs owned by someone else throw.
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

// createServer(cb) -> cb(err, handle)
// handle: EventEmitter with .path, .connected, .send(obj) and .close().
//         Emits 'event' with every {"event": ...} object Prey.app sends.
const createServer = (cb) => {
  let dir;
  try {
    dir = fs.mkdtempSync(path.join(tmpDir, DIR_PREFIX));
    // o+x so the logged user can traverse in, but no o+r so the socket name
    // cannot be found by listing the directory.
    fs.chmodSync(dir, 0o711);
  } catch (e) {
    cb(e);
    return null;
  }

  const sockPath = path.join(dir, SOCKET_NAME);
  const handle = new EventEmitter();
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
      // The containing dir is 0711 with an unguessable name, so the socket is
      // still unreachable to anyone who does not already know the full path.
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
