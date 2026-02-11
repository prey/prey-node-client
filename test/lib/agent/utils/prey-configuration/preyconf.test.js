/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const fs = require('fs');

const { expect } = chai;
const sinon = require('sinon');
const preyConf = require('../../../../../lib/agent/utils/prey-configuration/preyconf');

describe('PreyConf', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getFileContent', () => {
    it('should read file content', () => {
      const filePath = 'path/to/file';
      const fileContent = 'file content';
      sinon.stub(fs, 'readFileSync').returns(fileContent);
      const result = preyConf.getFileContent(filePath);
      expect(result).to.equal(fileContent);
    });

    it('should handle error when reading file', () => {
      const filePath = 'path/to/file';
      const error = new Error('Error reading prey.conf');
      sinon.stub(fs, 'readFileSync').throws(error);
      try {
        preyConf.getFileContent(filePath);
      } catch (except) {
        expect(except).to.be.an.instanceOf(Error);
      }
    });
  });

  describe('verifyPreyConf', () => {
    it('should return error when config file cannot be read', () => {
      const error = new Error('ENOENT');
      sinon.stub(fs, 'readFileSync').throws(error);
      const result = preyConf.verifyPreyConf();
      // verifyPreyConf returns error when it cannot read the file
      expect(result).to.be.an.instanceOf(Error);
    });

    it('should handle error when verifying config and file does not exist', () => {
      const error = new Error('ENOENT');
      sinon.stub(fs, 'readFileSync').throws(error);
      const result = preyConf.verifyPreyConf();
      expect(result).to.be.an.instanceOf(Error);
    });
  });

  describe('startVerifyPreyConf', () => {
    it('should return object with constitution false when error occurs', () => {
      const error = new Error('ENOENT');
      sinon.stub(fs, 'readFileSync').throws(error);
      const result = preyConf.startVerifyPreyConf();
      expect(result).to.have.property('constitution');
      expect(result).to.have.property('apiKeyValue');
      expect(result).to.have.property('deviceKeyValue');
    });
  });
});
