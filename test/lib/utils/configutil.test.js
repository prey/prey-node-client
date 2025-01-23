/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/utils/configutil.test.js
const chai = require('chai');
const sinon = require('sinon');

const { expect } = chai;
const configutil = require('../../../lib/utils/configutil');
const storage = require('../../../lib/agent/utils/storage');

describe('configutil test', () => {
  describe('getDataDbKey', () => {
    it('debería obtener datos de la base de datos', (done) => {
      const whatToGet = 'clave-de-prueba';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb(null, [{ id: 1, value: 'valor-de-prueba' }]);
      });
      configutil.getDataDbKey(whatToGet, callback);
      expect(callback.calledWith(null, [{ id: 1, value: 'valor-de-prueba' }])).to.be.true;
      storageStub.restore();
      done();
    });

    it('debería manejar un error al obtener datos de la base de datos', (done) => {
      const whatToGet = 'clave-de-prueba';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb(new Error('Error al obtener datos'));
      });
      configutil.getDataDbKey(whatToGet, callback);
      expect(callback.calledWith(sinon.match.instanceOf(Error))).to.be.true;
      storageStub.restore();
      done();
    });
  });

  describe('setKey', () => {
    it('debería establecer un valor en la base de datos', (done) => {
      const whatToGet = 'clave-de-prueba';
      const valuetoSet = 'valor-de-prueba';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb();
      });
      configutil.setKey(whatToGet, valuetoSet, callback);
      expect(callback.called).to.be.true;
      storageStub.restore();
      done();
    });
  });

  describe('updateKey', () => {
    it('debería actualizar un valor en la base de datos', (done) => {
      const whatToGet = 'clave-de-prueba';
      const valuetoSet = 'nuevo-valor-de-prueba';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb();
      });
      configutil.updateKey(whatToGet, valuetoSet, callback);
      expect(callback.called).to.be.true;
      storageStub.restore();
      done();
    });
  });

  describe('saveToDbKey', () => {
    it('debería guardar un valor en la base de datos', (done) => {
      const whatToGet = 'clave-de-prueba';
      const valuetoSet = 'valor-de-prueba';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb();
      });
      configutil.saveToDbKey(whatToGet, valuetoSet, callback);
      expect(callback.called).to.be.true;
      storageStub.restore();
      done();
    });
  });
});
