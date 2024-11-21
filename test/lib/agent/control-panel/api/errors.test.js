const { expect } = require('chai');
const sinon = require('sinon');
const errors = require('../../../../../lib/agent/control-panel/api/errors');
describe('Errors Module', () => {
  describe('get function', () => {
    it('should return an error with the correct message for a known code', () => {
      const err = errors.get('MISSING_KEY');
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Both API and Device keys are needed.');
      expect(err.code).to.equal('MISSING_KEY');
    });

    it('should return an error with the code as the message if the code is not found', () => {
      const err = errors.get('UNKNOWN_RESPONSE');
      expect(err.message).to.equal('UNKNOWN_RESPONSE');
    });
  });

  describe('arguments function', () => {
    it('should return an error with the provided message', () => {
      const err = errors.arguments('Custom argument error');
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Custom argument error');
      expect(err.code).to.equal('ARGUMENT_ERROR');
    });

    it('should return an error with a default message if no message is provided', () => {
      const err = errors.arguments();
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Invalid arguments.');
      expect(err.code).to.equal('ARGUMENT_ERROR');
    });
  });

  describe('unprocessable function', () => {
    it('should return a formatted error message for object errors', () => {
      const inputErrors = {
        email: ['is invalid', 'is already taken'],
        password: ['is too short']
      };
      const err = errors.unprocessable(inputErrors);
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.include('Email: is invalid, is already taken');
      expect(err.message).to.include('Password: is too short');
      expect(err.code).to.equal('UNPROCESSABLE_DATA');
    });

    it('should replace "í" with "i" on Windows platform', () => {
      sinon.stub(process, 'platform').value('win32');
      const inputErrors = {
        error: ['Este es un error con acento í']
      };
      const err = errors.unprocessable(inputErrors);
      expect(err.message).to.include('Este es un error con acento i');
      expect(err.code).to.equal('UNPROCESSABLE_DATA');
      sinon.restore();
    });

    it('should return an error with the message if a string is provided', () => {
      const err = errors.unprocessable('Some unprocessable error');
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Some unprocessable error');
      expect(err.code).to.equal('UNPROCESSABLE_DATA');
    });
  });

  describe('unknown function', () => {
    it('should return an error with the response body and status code', () => {
      const resp = { body: 'Unexpected error', statusCode: 500 };
      const err = errors.unknown(resp);
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Unexpected error (500)');
      expect(err.code).to.equal('UNKNOWN_RESPONSE');
    });
  });

  describe('validation function', () => {
    it('should return an error with the provided validation message', () => {
      const err = errors.validation('Validation failed');
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('Validation failed');
      expect(err.code).to.equal('VALIDATION_ERROR');
    });
  });
});
