/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const fs = require('fs');

const { expect } = chai;
const sinon = require('sinon');
const preyConf = require('../../../../../lib/agent/utils/prey-configuration/preyconf');

describe('PreyConf', () => {
  describe('getFileContent', () => {
    it('debería leer el contenido de un archivo', () => {
      const filePath = 'path/to/file';
      const fileContent = 'contenido del archivo';
      sinon.stub(fs, 'readFileSync').returns(fileContent);
      const result = preyConf.getFileContent(filePath);
      expect(result).to.equal(fileContent);
      fs.readFileSync.restore();
    });

    it('debería manejar un error al leer el archivo', () => {
      const filePath = 'path/to/file';
      const error = new Error('Error reading prey.conf');
      sinon.stub(fs, 'readFileSync').throws(error);
      try {
        preyConf.getFileContent(filePath);
      } catch (except) {
        expect(except).to.be.an.instanceOf(Error);
      }
      fs.readFileSync.restore();
    });
  });

  describe('verifyPreyConf', () => {
    it('debería verificar la configuración de Prey', () => {
      const preyConfData = { /* datos de configuración */ };
      const result = preyConf.verifyPreyConf(preyConfData);
      expect(result).to.be.true;
    });

    it('debería manejar un error al verificar la configuración', () => {
      const preyConfData = { /* datos de configuración */ };
      const error = new Error('Error verificando configuración');
      sinon.stub(preyConf, 'verifyPreyConfData').throws(error);
      const result = preyConf.verifyPreyConf(preyConfData);
      expect(result).to.be.false;
      preyConf.verifyPreyConfData.restore();
    });
  });

  describe('store', () => {
    it('debería almacenar la configuración de Prey', () => {
      const file = 'path/to/file';
      const callback = sinon.stub();
      preyConf.store(file, callback);
      expect(callback.calledOnce).to.be.true;
    });

    it('debería manejar un error al almacenar la configuración', () => {
      const file = 'path/to/file';
      const error = new Error('Error almacenando configuración');
      sinon.stub(preyConf.fs, 'writeFile').throws(error);
      const callback = sinon.stub();
      preyConf.store(file, callback);
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.equal(error);
      preyConf.fs.writeFile.restore();
    });
  });

  // ... otros tests ...
});
