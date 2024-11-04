/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const net = require('net');
// eslint-disable-next-line import/no-extraneous-dependencies
const rewire = require('rewire');
// eslint-disable-next-line import/no-extraneous-dependencies
const { expect } = require('chai');

const socket = require('../../../lib/agent/socket');

describe('verifyConsistencyData', () => {
  it('debería retornar true si el objeto tiene las propiedades requeridas', () => {
    const dataObj = { function: 'test', success: true, output: 'output' };
    expect(socket.verifyConsistencyData(dataObj)).to.be.true;
  });

  it('debería retornar false si el objeto no tiene la propiedad "function"', () => {
    const dataObj = { success: true, output: 'output' };
    expect(socket.verifyConsistencyData(dataObj)).to.be.false;
  });

  it('debería retornar false si el objeto no tiene la propiedad "success"', () => {
    const dataObj = { function: 'test', output: 'output' };
    expect(socket.verifyConsistencyData(dataObj)).to.be.false;
  });

  it('debería retornar false si el objeto no tiene la propiedad "output"', () => {
    const dataObj = { function: 'test', success: true };
    expect(socket.verifyConsistencyData(dataObj)).to.be.false;
  });
});

describe('processOwnershipResult', () => {
  it('Deberia devolver un array con el owner de manera correcta', (done) => {
    socket.processOwnershipResult((err, owner) => {
      expect(err).to.be.null;
      expect(owner[0]).to.equal('owner');
      done();
    }, null, 'owner', null);
  });

  it('debería llamar al callback con un error', (done) => {
    const error = new Error('Test error');
    socket.processOwnershipResult((err) => {
      expect(err).to.equal(error.message);
      done();
    }, error, null, null);
  });
  it('debería llamar al callback con un standard error', (done) => {
    const error = 'Test error';
    socket.processOwnershipResult((err) => {
      expect(err).to.equal(error);
      done();
    }, null, null, error);
  });
});
describe('writeMessage', () => {
  it('debería llamar al callback en Mac', () => {
    const cb = sinon.stub();
    socket.writeMessage('location-get-location-native', cb);
    expect(cb.calledOnce).to.be.true;
  });

  it('debería no llamar al callback en no Mac', () => {
    socket.osName = 'windows';
    socket.writeMessage('location-get-location-native', (err) => {
      expect(err).to.be.undefined;
    });
  });

  it('debería devolver un error si el nombre de la funcion no existe', () => {
    socket.activeToSend = false;
    socket.osName = 'mac';
    socket.writeMessage('functionName', (error) => {
      expect(error instanceof Error).to.be.true;
    });
  });

  it('debería llamar al callback con error en inactive', () => {
    socket.activeToSend = false;
    socket.osName = 'mac';
    socket.writeMessage('location-get-location-native', (error) => {
      expect(error instanceof Error).to.be.true;
    });
  });
});

describe('addAndWait', () => {
  let socketAddAndWait;
  beforeEach(() => {
    socketAddAndWait = rewire('../../../lib/agent/socket');
    // eslint-disable-next-line no-underscore-dangle
    socketAddAndWait.__set__('sendMessage', () => {});
    // eslint-disable-next-line no-underscore-dangle
    socketAddAndWait.__set__('tryToSendNew', () => {});
    socketAddAndWait.messagesData = [];
    socketAddAndWait.currentMessage = null;
    socketAddAndWait.intervalToSendMessages = null;
    socketAddAndWait.timeLimitPerMessageDefault = 15000;
  });

  afterEach(() => {
    clearInterval(socketAddAndWait.intervalToSendMessages);
    // eslint-disable-next-line no-underscore-dangle
  });
  it('should set cbAttached to an empty function when cb is not a function', (done) => {
    socketAddAndWait.addAndWait('location-get-location-native', null);
    expect(socketAddAndWait.currentMessage.cbAttached).to.be.a('function');
    done();
  });
  it('should set timeLimitPerMessage to timeLimitPerMessageDefault when time is not provided', () => {
    socketAddAndWait.addAndWait('location-get-location-native', () => {});
    setTimeout(() => {
      expect(socketAddAndWait.currentMessage.timeLimitPerMessage)
        .to.equal(socketAddAndWait.timeLimitPerMessageDefault);
    }, 1);
  });
  it('should set currentMessage to the new message and call sendMessage when there is no currentMessage', () => {
    socketAddAndWait.addAndWait('location-get-location-native', () => {});
    setTimeout(() => {
      expect(socketAddAndWait.currentMessage.functionName).to.equal('location-get-location-native');
    }, 1);
  });
  it('should push the new message to messagesData when there is a currentMessage', () => {
    socketAddAndWait.addAndWait('location-get-location-native', () => {});
    setTimeout(() => {
      expect(socketAddAndWait.messagesData.length).to.equal(1);
      expect(socketAddAndWait.messagesData[0].functionName).to.equal('location-get-location-native');
    }, 1);
  });
  it('should set intervalToSendMessages to an interval calling tryToSendNew every 500ms when it is not set', () => {
    socketAddAndWait.addAndWait('location-get-location-native', () => {});
    setTimeout(() => {
      expect(socketAddAndWait.intervalToSendMessages).to.be.a('object');
    }, 1);
  });
});

describe('tryToSendNew', () => {
  let socketTryToSendNew;
  beforeEach(() => {
    socketTryToSendNew = rewire('../../../lib/agent/socket');
    // eslint-disable-next-line no-underscore-dangle
    socketTryToSendNew.__set__('sendMessage', () => {});
    socketTryToSendNew.messagesData = [];
    socketTryToSendNew.currentMessage = null;
    socketTryToSendNew.intervalToSendMessages = null;
    socketTryToSendNew.timeLimitPerMessageDefault = 15000;
  });

  afterEach(() => {
  });

  it('removes messages with exceeded time limit and calls their callbacks with an error', () => {
    const message = {
      time: Date.now() - 10000,
      timeLimitPerMessage: 5000,
      cbAttached: sinon.stub(),
      functionName: 'location-get-location-native',
    };
    socketTryToSendNew.messagesData.push(message);
    socketTryToSendNew.tryToSendNew.call();
    expect(message.cbAttached.calledOnce).to.be.true;
    expect(message.cbAttached.args[0][0].message).to.equal('Time exceeded for location-get-location-native');
    expect(socketTryToSendNew.messagesData.length).to.equal(0);
  });

  it('updates currentMessage when a message is completed', () => {
    const message = {
      time: Date.now(),
      timeLimitPerMessage: 5000,
      completed: true,
    };
    socketTryToSendNew.messagesData.push(message);
    socketTryToSendNew.currentMessage = message;
    socketTryToSendNew.tryToSendNew.call();
    expect(socketTryToSendNew.currentMessage).to.be.null;
  });

  it('sets currentMessage to null when messagesData is empty', () => {
    socketTryToSendNew.messagesData = [];
    socketTryToSendNew.tryToSendNew.call();
    expect(socketTryToSendNew.currentMessage).to.be.null;
  });

  it('calls callback function cbAttached with an error when time limit is exceeded', () => {
    const message = {
      time: new Date().getTime() - 10000,
      timeLimitPerMessage: 5000,
      cbAttached: sinon.stub(),
    };
    socketTryToSendNew.messagesData.push(message);
    socketTryToSendNew.tryToSendNew.call();
    expect(message.cbAttached.calledWith(sinon.match.instanceOf(Error))).to.be.true;
  });

  it('should delete message already completed', () => {
    const message = {
      completed: true,
      time: new Date().getTime(),
      timeLimitPerMessage: 15000,
      cbAttached: sinon.stub(),
    };
    socketTryToSendNew.currentMessage = message;
    socketTryToSendNew.messagesData.push(message);
    socketTryToSendNew.tryToSendNew.call();
    expect(socketTryToSendNew.messagesData).to.be.empty;
  });

  it('message should be deleted from messageData and currentMessage should be equal to second obj', () => {
    const message = {
      completed: true,
      time: new Date().getTime(),
      timeLimitPerMessage: 15000,
      cbAttached: sinon.stub(),
    };
    const message2 = {
      completed: false,
      time: new Date().getTime(),
      timeLimitPerMessage: 15000,
      cbAttached: sinon.stub(),
    };
    socketTryToSendNew.currentMessage = message;
    socketTryToSendNew.messagesData.push(message);
    socketTryToSendNew.messagesData.push(message2);
    socketTryToSendNew.tryToSendNew.call();
    expect(socketTryToSendNew.currentMessage).to.be.equal(message2);
  });

  it('message should be completed', () => {
    const message = {
      completed: false,
      time: new Date().getTime() - 30000,
      timeLimitPerMessage: 15000,
      cbAttached: sinon.stub(),
    };
    socketTryToSendNew.currentMessage = message;
    socketTryToSendNew.messagesData.push(message);
    socketTryToSendNew.tryToSendNew.call();
    expect(socketTryToSendNew.messagesData).to.be.empty;
  });
});

// ////////////////////

describe('handleDataConnection', () => {
  let socketHandleDataConnection;
  let messageToSendSocket;
  let messageD;
  let data;
  let cb;

  beforeEach(() => {
    socketHandleDataConnection = rewire('../../../lib/agent/socket');
    // eslint-disable-next-line no-underscore-dangle
    socketHandleDataConnection.__set__('verifyConsistencyData', () => true);
    const timeSet = new Date().getTime();
    cb = sinon.stub();
    messageD = {
      functionName: 'screenshot-native',
      toSend: {},
      completed: false,
      cbAttached: () => { },
      timeLimitPerMessage: 15000,
      time: timeSet,
    };
    socketHandleDataConnection.currentMessage = messageD;
    messageToSendSocket = {
      message: messageD,
      cb: () => {},
    };
    data = '{"success":"testName","function":"native", "output": "true", "name": "screenshot-native"}';
  });

  it('should handle successful data connection', () => {
    socketHandleDataConnection.handleDataConnection(messageToSendSocket, data, cb);
    expect(cb.calledOnce).to.be.true;
    expect(cb.args[0][0]).to.be.null;
  });

  it('should handle invalid data parsing', () => {
    data = 'invalid data';
    socketHandleDataConnection.handleDataConnection(messageToSendSocket, data, cb);
    expect(cb.calledOnce).to.be.true;
    expect(cb.args[0][0] instanceof Error).to.be.true;
  });

  it('should handle current message already completed', () => {
    const timeSet = new Date().getTime();
    messageD = {
      functionName: 'screenshot-native',
      toSend: {},
      completed: true,
      cbAttached: () => { },
      timeLimitPerMessage: 15000,
      time: timeSet,
    };
    socketHandleDataConnection.currentMessage = messageD;
    messageToSendSocket = {
      message: messageD,
      cb: () => {},
    };
    socketHandleDataConnection.handleDataConnection(messageToSendSocket, data, cb);
    expect(cb.calledOnce).to.be.true;
    expect(cb.args[0][0]).to.be.null;
  });
});

describe('ownerShipVerify', () => {
  it('should call callback with error when err is truthy', () => {
    const err = new Error('Test error');
    const owner = 'prey';
    const cb = sinon.spy();
    socket.ownerShipVerify(err, owner, cb);
    expect(cb.calledOnce).to.be.true;
    expect(cb.args[0][0]).to.equal(err);
  });

  it('should call callback with error when owner does not include "prey"', () => {
    const err = null;
    const owner = 'other';
    const cb = sinon.spy();
    socket.ownerShipVerify(err, owner, cb);
    expect(cb.calledOnce).to.be.true;
    expect(cb.args[0][0].message).to.equal('The socket file is not owned by Prey');
  });

  it('should call callback without error when owner includes "prey" and no error', () => {
    const err = null;
    const owner = 'prey';
    const cb = sinon.spy();
    socket.ownerShipVerify(err, owner, cb);
    expect(cb.calledOnce).to.be.true;
    expect(cb.args[0][0]).to.be.undefined;
  });
});

describe('handleConnection', () => {
  let handleDataConnectionStub;
  let socketConnectionInstance;
  let messageToSendSocket;
  let socketConnection;
  let socketHandleConnection;
  let cb;
  beforeEach(() => {
    handleDataConnectionStub = () => { console.log('handleDataConnectionStub BABYYYYYYYYY'); };
    socketHandleConnection = rewire('../../../lib/agent/socket');
    // eslint-disable-next-line no-underscore-dangle
    socketHandleConnection.__set__('handleDataConnection', handleDataConnectionStub);
    socketConnectionInstance = {
      write: sinon.stub(),
      on: sinon.stub(),
      emit: sinon.stub(),
      destroy: sinon.stub(),
    };
    socketConnection = sinon.stub(net, 'createConnection').returns(socketConnectionInstance);
    messageToSendSocket = { functionName: 'test' };
    cb = sinon.stub();
  });

  afterEach(() => {
    socketConnection.restore();
  });

  it('creates a socket connection', () => {
    socketHandleConnection.handleConnection(messageToSendSocket, cb);
    expect(socketConnection.calledOnce).to.be.true;
  });

  it('writes to the socket connection', () => {
    socketHandleConnection.handleConnection(messageToSendSocket, cb);
    expect(socketConnection().write.calledOnce).to.be.true;
  });
});

describe('createConnectionSocket', () => {
  let checkSocketFileExists;
  let getOwnerShip;
  let ownerShipVerify;
  let handleConnection;
  let messageToSendSocket;
  let cb;

  beforeEach(() => {
    // socketCreateConnectionSocket = rewire('../../../lib/agent/socket');
    checkSocketFileExists = sinon.stub().returns(true);
    getOwnerShip = sinon.stub().callsArgWith(0, null, 'prey');
    ownerShipVerify = sinon.stub().callsArgWith(2, null);
    handleConnection = sinon.stub();
    messageToSendSocket = { functionName: 'test' };
    cb = sinon.stub();
  });

  it('should log error and not call handleConnection when socket file does not exist', () => {
    checkSocketFileExists.returns(false);
    socket.createConnectionSocket(messageToSendSocket, cb);
    expect(handleConnection.called).to.be.false;
  });

  it('should log error and not call handleConnection when ownership verification fails', () => {
    ownerShipVerify.callsArgWith(2, new Error('Test error'));
    socket.createConnectionSocket(messageToSendSocket, cb);
    expect(handleConnection.called).to.be.false;
  });

  it('should log error when error occurs between ownership and local socket', () => {
    getOwnerShip.callsArgWith(0, new Error('Test error'));
    socket.createConnectionSocket(messageToSendSocket, cb);
  });
});
