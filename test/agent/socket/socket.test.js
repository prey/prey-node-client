/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
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
    socket.writeMessage('functionName', cb);
    expect(cb.calledOnce).to.be.true;
  });

  it('debería no llamar al callback en no Mac', () => {
    socket.osName = 'windows';
    socket.writeMessage('functionName', (err) => {
      expect(err).to.be.undefined;
    });
  });

  it('debería llamar al callback con error en inactive', () => {
    socket.activeToSend = false;
    socket.osName = 'mac';
    socket.writeMessage('functionName', (error) => {
      expect(error instanceof Error).to.be.true;
    });
  });
});

// describe('sendMessage', () => {
//   afterEach(() => {
//     sinon.restore();
//   });
//   it('debería llamar a createConnectionSocket si el objeto tiene la propiedad "functionName"', (done) => {
//     const sendMessageStub = sinon.stub();
//     const createConnectionSocketStub = sinon.stub();
//     const messageToSend = {
//       functionName: 'location-get-location-native',
//       cbAttached: sendMessageStub,
//     };

//     socket.sendMessage(messageToSend, sendMessageStub);
//     setTimeout(() => {
//       expect(createConnectionSocketStub.calledOnce).to.be.true;
//       done();
//     }, 0);
//   });

//   it('no debería llamar a createConnectionSocket si el objeto no tiene la propiedad "functionName"', (done) => {
//     const sendMessageStub = sinon.stub();
//     const createConnectionSocketStub = sinon.stub();
//     const messageToSend = {
//       functionName: 'location-get-location-native',
//       cbAttached: sendMessageStub,
//     };

//     socket.sendMessage(messageToSend, sendMessageStub);
//     setTimeout(() => {
//       expect(createConnectionSocketStub.calledOnce).to.be.false;
//       done();
//     }, 0);
//   });
// });

// describe('addAndWait', () => {
// eslint-disable-next-line max-len
//   it('debería agregar el mensaje a la cola y llamar a sendMessage si no hay un mensaje actual', () => {
//     const functionName = 'location-get-location-native';
//     const cb = sinon.stub();
//     const fnsendMessage = sinon.stub(socket, 'sendMessage').yields();
//     addAndWait(functionName, cb);
//     setTimeout(() => {
//       expect(fnsendMessage.calledOnce).to.be.true;
//     }, 1000);
//   });

// eslint-disable-next-line max-len
//   it('debería agregar el mensaje a la cola y no llamar a sendMessage si hay un mensaje actual', () => {
//     const functionName = 'location-get-location-native';
//     const cb = sinon.stub();
//     const fnsendMessage = sinon.stub(socket, 'sendMessage').yields();
//     addAndWait(functionName, cb);
//     expect(fnsendMessage.called).to.be.false;
//   });
// });
