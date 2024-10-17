/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
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
  let clock;
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
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('removes messages with exceeded time limit and calls their callbacks with an error', () => {
    const message = {
      time: Date.now() - 10000,
      timeLimitPerMessage: 5000,
      cbAttached: sinon.stub(),
      functionName: 'test-function',
    };
    socketAddAndWait.messagesData.push(message);
    socketAddAndWait.tryToSendNew.call();
    expect(message.cbAttached.calledOnce).to.be.true;
    expect(message.cbAttached.args[0][0].message).to.equal('Time exceeded for test-function');
    expect(socketAddAndWait.messagesData.length).to.equal(0);
  });

  // it('keeps messages within time limit in messagesData', () => {
  //   const message = {
  //     time: Date.now(),
  //     timeLimitPerMessage: 5000,
  //     cbAttached: sinon.stub(),
  //     functionName: 'test-function',
  //   };
  //   socketAddAndWait.messagesData.push(message);
  //   socketAddAndWait.tryToSendNew();
  //   expect(socketAddAndWait.messagesData.length).to.equal(1);
  //   expect(socketAddAndWait.messagesData[0]).to.eql(message);
  // });

  // it('updates currentMessage correctly when a message is completed', () => {
  //   const message1 = {
  //     time: Date.now(),
  //     timeLimitPerMessage: 5000,
  //     cbAttached: sinon.stub(),
  //     functionName: 'test-function-1',
  //   };
  //   const message2 = {
  //     time: Date.now(),
  //     timeLimitPerMessage: 5000,
  //     cbAttached: sinon.stub(),
  //     functionName: 'test-function-2',
  //   };
  //   socketAddAndWait.messagesData.push(message1);
  //   socketAddAndWait.messagesData.push(message2);
  //   socketAddAndWait.currentMessage = message1;
  //   message1.completed = true;
  //   tryToSendNew.call(exportsStub);
  //   expect(socketAddAndWait.currentMessage).toBe(message2);
  // });

  // it('sets currentMessage to null when messagesData is empty', () => {
  //   exportsStub.messagesData = [];
  //   tryToSendNew.call(exportsStub);
  //   expect(exportsStub.currentMessage).toBe(null);
  // });

  // it('calls sendMessage with the next message in messagesData when currentMessage is completed', () => {
  //   const message1 = {
  //     time: Date.now(),
  //     timeLimitPerMessage: 5000,
  //     cbAttached: sinon.stub(),
  //     functionName: 'test-function-1',
  //   };
  //   const message2 = {
  //     time: Date.now(),
  //     timeLimitPerMessage: 5000,
  //     cbAttached: sinon.stub(),
  //     functionName: 'test-function-2',
  //   };
  //   exportsStub.messagesData.push(message1);
  //   exportsStub.messagesData.push(message2);
  //   exportsStub.currentMessage = message1;
  //   message1.completed = true;
  //   tryToSendNew.call(exportsStub);
  //   expect(sendMessageStub.calledOnce).toBe(true);
  //   expect(sendMessageStub.args[0][0]).toBe(message2);
  // });
});
