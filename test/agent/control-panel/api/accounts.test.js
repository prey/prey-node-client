const sinon = require('sinon');
const { expect } = require('chai');
const request = require('../../../../lib/agent/control-panel/api/request');
const errors = require('../../../../lib/agent/control-panel/api/errors');
const keys = require('../../../../lib/agent/control-panel/api/keys');
const auth = require('../../../../lib/agent/control-panel/api/accounts');

describe('auth', () => {
  describe('authorize', () => {
    let requestStub = sinon.stub(request, 'get');
    beforeEach(() => {
      keys.unset('api');
    });

    it('should throw an error if no credentials are passed', () => {
      keys.set({ api: 'existing-key' });
      expect(() => auth.authorize()).to.throw(Error, 'No credentials passed!');
    });

    it('should throw an error if API key is already set', () => {
      keys.set({ api: 'existing-key' });
      expect(() => auth.authorize({ username: 'test', password: 'test' })).to.throw(Error, 'API key already set!');
    });

    it('should make a GET request to /profile.json', () => {
      auth.authorize({ username: 'test', password: 'test' }, () => {});
      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/profile.json?lang=en');
    });

 /*    it('should handle 401 response', () => {
      requestStub.yields(null, { statusCode: 401, body: { error: 'Invalid credentials' } });
      auth.authorize({ username: 'test', password: 'test' }, (err) => {
        expect(err).to.be.an.instanceof(errors.unprocessable);
        expect(err.message).to.equal('Invalid credentials');
      });
    }); */
  });

  describe('signup', () => {
    it('should throw an error if empty data is passed', () => {
      expect(() => auth.signup()).to.throw(Error, 'Empty data.');
    });

    it('should throw an error if API key is already set', () => {
      keys.set({ api: 'existing-key' });
      expect(() => auth.signup({ username: 'user', password: 'pass' })).to.throw(Error, 'API key already set!');
    });

    /* it('should validate data using the validate function', () => {
      const validateStub = sinon.stub(auth, 'validate');
      validateStub.returns('Error message');
      auth.signup({ policy_rule_privacy_terms: true }, (err) => {
        expect(err).to.be.an.instanceof(errors.validation);
        expect(err.message).to.equal('Error message');
      });
    });

    it('should make a POST request to /signup.json', () => {
      const requestStub = sinon.stub(request, 'post');
      auth.signup({ policy_rule_privacy_terms: true }, () => {});
      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/signup.json?lang=en');
    });

    it('should handle 422 response', () => {
      const requestStub = sinon.stub(request, 'post');
      requestStub.yields(null, { statusCode: 422, body: { error: 'Validation error' } });
      auth.signup({ policy_rule_privacy_terms: true }, (err) => {
        expect(err).to.be.an.instanceof(errors.unprocessable);
        expect(err.message).to.equal('Validation error');
      });
    }); */
  });

  describe('validate function', () => {
    it('should return an error if Terms & Conditions are not accepted', () => {
      const data = { policy_rule_age: true }; // Age rule is set, but not the terms and conditions
      const result = auth.validate(data);
      expect(result).to.equal('You need to accept the Terms & Conditions and Privacy Policy to continue');
    });
  
    it('should return an error if user is under 16 years old', () => {
      const data = { policy_rule_privacy_terms: true }; // Terms accepted but no age rule
      const result = auth.validate(data);
      expect(result).to.equal('You must be older than 16 years old to use Prey');
    });
  
    it('should return undefined if both conditions are met', () => {
      const data = { policy_rule_privacy_terms: true, policy_rule_age: true };
      const result = auth.validate(data);
      expect(result).to.be.undefined; // No error message, validation passes
    });
  });
});