/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/agent/control-panel/websockets/server.test.js
const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');

describe('server.js test function', () => {
  let serverRewired;
  let osName;
  let cbStub;

  beforeEach(() => {
    serverRewired = rewire('../../../../../lib/agent/control-panel/websockets/server');
    osName = serverRewired.osName;
    serverRewired.execCmd = sinon.stub().callsFake((cmd, cb) => cb(null, null));
    cbStub = sinon.stub();
  });

  afterEach(() => {
    serverRewired.osName = osName;
  });

  describe('checkService function', () => {
    it('should return true on mac', () => {
      serverRewired.osName = 'mac';
      serverRewired.check_service(cbStub);
      expect(cbStub.calledWith(true)).to.be.true;
    });

    it('should return false on windows if service version is not 1.2.0 or greater', () => {
      serverRewired.osName = 'windows';
      // eslint-disable-next-line global-require
      serverRewired.sysWin = {
        get_winsvc_version: sinon.stub().callsFake((cb) => cb(null, '1.1.0')),
      };
      serverRewired.check_service(cbStub);
      expect(cbStub.calledWith(false)).to.be.true;
    });

    it('should return true on windows if service version is 1.2.0 or greater', () => {
      serverRewired.osName = 'windows';
      // eslint-disable-next-line global-require
      const sysWin = require('../../../../../lib/system/windows');
      sysWin.get_winsvc_version = sinon.stub().callsFake((cb) => cb(null, '1.2.0'));
      serverRewired.check_service(cbStub);
      expect(cbStub.calledWith(true)).to.be.true;
    });
  });

  describe('checkServerDown function', () => {
    it('should call exec with the correct command on mac', () => {
      serverRewired.osName = 'mac';
      serverRewired.check_server_down(cbStub);
      expect(serverRewired.execCmd.calledWith('lsof -Pi :7738 | sed -n \'2 p\'| awk \'{print $2}\'')).to.be.true;
    });

    it('should call exec with the correct command on windows', () => {
      serverRewired.osName = 'windows';
      serverRewired.check_server_down(cbStub);
      expect(serverRewired.execCmd.calledWith('for /F "tokens=1,2,3,4,5" %A in (\'"netstat -ano | find "LISTENING" | find "127.0.0.1:7738""\') DO @echo %~E')).to.be.true;
    });

    it('should return an error if exec returns an error', () => {
      serverRewired.execCmd = sinon.stub().callsFake((cmd, cb) => cb(null, null));
      serverRewired.check_server_down((err) => {
        expect(err).to.be.an.instanceOf(Error);
      });
    });

    it('should not return an error', () => {
      serverRewired.execCmd = sinon.stub().callsFake((cmd, cb) => cb(null, '111'));
      serverRewired.check_server_down((err) => {
        expect(err).to.not.be.an.instanceOf(Error);
      });
    });
  });

  describe('reactToHealtz function', () => {
    it('should change default location strategy and write 200', () => {
      serverRewired.osName = 'mac';
      serverRewired.websocket = {
        check_timestamp: () => true,
      };
      const writeHead = sinon.stub();
      serverRewired.reactToHealtz({ url: 'location=true' }, { writeHead, end: sinon.stub() });
      expect(writeHead.calledWith(200)).to.be.true;
    });

    it('should write 400', () => {
      serverRewired.osName = 'windows';
      serverRewired.websocket = {
        check_timestamp: () => false,
      };
      const writeHead = sinon.stub();
      serverRewired.reactToHealtz({ }, { writeHead, end: sinon.stub() });
      expect(writeHead.calledWith(400)).to.be.true;
    });
  });

  describe('reactToPermissions function', () => {
    it('should call geo.get_location when permission is Authorized and location', () => {
      const req = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              status: 'Authorized',
              permission: 'location',
              os: 'macos',
            }));
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {
        writeHead: sinon.stub(),
        end: sinon.stub(),
      };
      serverRewired.geo = {
        get_location: sinon.stub(),
      };
      serverRewired.reactToPermissions(req, res);
      expect(serverRewired.geo.get_location.calledOnce).to.be.true;
    });

    it('should not call geo.get_location when permission is not Authorized or location', () => {
      const req = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              status: 'Denied',
              permission: 'location',
              os: 'macos',
            }));
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {
        writeHead: sinon.stub(),
        end: sinon.stub(),
      };
      serverRewired.geo = {
        get_location: sinon.stub(),
      };
      serverRewired.reactToPermissions(req, res);
      expect(serverRewired.geo.get_location.notCalled).to.be.true;
    });

    it('should write 200 response', () => {
      const req = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              status: 'Authorized',
              permission: 'location',
              os: 'macos',
            }));
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {
        writeHead: sinon.stub(),
        end: sinon.stub(),
      };
      serverRewired.reactToPermissions(req, res);
      expect(res.writeHead.calledWith(200)).to.be.true;
    });
  });

  describe('reactToHandling function', () => {
    it('should call reactToPermissions', () => {
      const req = { url: '/permission' };
      serverRewired.reactToPermissions = sinon.stub();
      serverRewired.reactToHandling(req, { });
      expect(serverRewired.reactToPermissions.calledOnce).to.be.true;
    });

    it('should call reactToActions', () => {
      const req = { url: '/actions' };
      serverRewired.reactToActions = sinon.stub();
      serverRewired.reactToHandling(req, { });
      expect(serverRewired.reactToActions.calledOnce).to.be.true;
    });

    it('should call reactToHealtz', () => {
      const req = { url: '/healthz' };
      serverRewired.reactToHealtz = sinon.stub();
      serverRewired.reactToHandling(req, { });
      expect(serverRewired.reactToHealtz.calledOnce).to.be.true;
    });
  });

  describe('reactToActions function', () => {
    it('should call commands.perform with parsed data', () => {
      const req = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              action: 'test',
              data: 'test data',
            }));
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {
        writeHead: sinon.stub(),
        end: sinon.stub(),
      };
      serverRewired.commands = {
        perform: sinon.stub(),
      };
      serverRewired.reactToActions(req, res);
      expect(serverRewired.commands.perform.calledWith({
        action: 'test',
        data: 'test data',
      })).to.be.true;
    });

    it('should not call commands.perform if data is not JSON', () => {
      const req = {
        on: (event, callback) => {
          if (event === 'data') {
            callback('Invalid JSON');
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {
        writeHead: sinon.stub(),
        end: sinon.stub(),
      };
      serverRewired.commands = {
        perform: sinon.stub(),
      };
      serverRewired.reactToActions(req, res);
      expect(serverRewired.commands.perform.notCalled).to.be.true;
    });

    it('should write 200 response', () => {
      const req = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              action: 'test',
              data: 'test data',
            }));
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {
        writeHead: sinon.stub(),
        end: sinon.stub(),
      };
      serverRewired.reactToActions(req, res);
      expect(res.writeHead.calledWith(200)).to.be.true;
    });
  });

  describe('create_server testing whatever', () => {
    it('should return error if osName is linux', () => {
      serverRewired.osName = 'linux';
      serverRewired.create_server((err) => {
        expect(err).to.be.an.instanceof(Error);
      });
    });

    it('should call check_service and return error if not valid', () => {
      serverRewired.osName = 'mac';
      serverRewired.check_service = sinon.stub().callsFake((cb) => cb(false));
      serverRewired.create_server((err) => {
        expect(err).to.be.an.instanceof(Error);
      });
    });

    it('should call check_serverDown and return error if error occurs', () => {
      serverRewired.osName = 'mac';
      serverRewired.check_service = sinon.stub().callsFake((cb) => cb(true));
      serverRewired.check_serverDown = sinon.stub().callsFake((cb) => cb(new Error('Error occurred')));
      serverRewired.http = {
        createServer: sinon.stub().callsFake(
          // eslint-disable-next-line no-unused-vars
          (req, res) => ({ on: sinon.stub(), listen: sinon.stub() }),
        ),
      };
      serverRewired.create_server((err) => {
        expect(err).to.not.be.an.instanceof(Error);
      });
    });
  });
});
