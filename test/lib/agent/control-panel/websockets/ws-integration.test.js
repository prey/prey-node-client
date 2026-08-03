const { expect } = require('chai');
const WebSocket = require('ws');
const rewire = require('rewire');

describe('WebSocket connection integration (real ws library)', function () {
  this.timeout(5000);

  let server;
  let port;
  let connection;
  let revertProxy;

  const logger = { info: () => {}, error: () => {} };

  const makeConfig = (p) => ({
    protocol: 'http',
    host: `localhost:${p}`,
    deviceKey: 'test-device',
    apiKey: 'test-api-key',
    userAgent: 'prey-test/1.0',
    proxy: null,
  });

  beforeEach((done) => {
    server = new WebSocket.Server({ port: 0 }, () => {
      port = server.address().port;
      connection = rewire('../../../../../lib/agent/control-panel/websockets/connection');
      revertProxy = connection.__set__('HttpsProxyAgent', function () { return null; });
      done();
    });
  });

  afterEach((done) => {
    revertProxy();
    connection.terminate();
    server.clients.forEach((client) => client.terminate());
    server.close(done);
  });

  it('should fire onOpen when connection is established', (done) => {
    connection.create(makeConfig(port), {
      onOpen: () => done(),
      onClose: () => {},
      onMessage: () => {},
      onError: done,
      onPong: () => {},
      onPing: () => {},
    }, logger);
  });

  it('should fire onMessage with data sent by server', (done) => {
    server.on('connection', (serverSocket) => {
      serverSocket.send('hello from server');
    });

    connection.create(makeConfig(port), {
      onOpen: () => {},
      onClose: () => {},
      onMessage: (data) => {
        expect(data.toString()).to.equal('hello from server');
        done();
      },
      onError: done,
      onPong: () => {},
      onPing: () => {},
    }, logger);
  });

  it('should fire onClose when server closes the connection', (done) => {
    server.on('connection', (serverSocket) => {
      serverSocket.close(1000);
    });

    connection.create(makeConfig(port), {
      onOpen: () => {},
      onClose: (code) => {
        expect(code).to.equal(1000);
        done();
      },
      onMessage: () => {},
      onError: done,
      onPong: () => {},
      onPing: () => {},
    }, logger);
  });

  it('should fire onError when connection is refused', (done) => {
    const badPort = 19999;
    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      if (err instanceof Error) done();
      else done(new Error('Expected connection error'));
    };

    connection.create(makeConfig(badPort), {
      onOpen: () => {},
      onClose: () => {},
      onMessage: () => {},
      onError: finish,
      onPong: () => {},
      onPing: () => {},
    }, logger);
  });

  it('send() should deliver message to server', (done) => {
    server.on('connection', (serverSocket) => {
      serverSocket.on('message', (data) => {
        expect(data.toString()).to.equal('test message');
        done();
      });
    });

    connection.create(makeConfig(port), {
      onOpen: () => {
        const sent = connection.send('test message');
        expect(sent).to.equal(true);
      },
      onClose: () => {},
      onMessage: () => {},
      onError: done,
      onPong: () => {},
      onPing: () => {},
    }, logger);
  });

  it('terminate() should close the connection on the server side', (done) => {
    server.on('connection', (serverSocket) => {
      serverSocket.on('close', () => done());
    });

    connection.create(makeConfig(port), {
      onOpen: () => connection.terminate(),
      onClose: () => {},
      onMessage: () => {},
      onError: done,
      onPong: () => {},
      onPing: () => {},
    }, logger);
  });

  it('should fire onPing when server sends a ping', (done) => {
    server.on('connection', (serverSocket) => {
      setTimeout(() => serverSocket.ping(), 50);
    });

    connection.create(makeConfig(port), {
      onOpen: () => {},
      onClose: () => {},
      onMessage: () => {},
      onError: done,
      onPong: () => {},
      onPing: () => done(),
    }, logger);
  });

  it('should fire onPong when server sends an unsolicited pong', (done) => {
    server.on('connection', (serverSocket) => {
      setTimeout(() => serverSocket.pong(), 50);
    });

    connection.create(makeConfig(port), {
      onOpen: () => {},
      onClose: () => {},
      onMessage: () => {},
      onError: done,
      onPong: () => done(),
      onPing: () => {},
    }, logger);
  });
});
