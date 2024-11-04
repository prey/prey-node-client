const sinon = require('sinon');
const { expect } = require('chai');
const request = require('../../../../lib/agent/control-panel/api/request');
const errors = require('../../../../lib/agent/control-panel/api/errors');
const keys = require('../../../../lib/agent/control-panel/api/keys');
const { authorize, signup, validate, set } = require('../../../../lib/agent/control-panel/api/accounts');

describe('auth', () => {
  describe('authorize', () => {
    let requestStub = sinon.stub(request, 'get');
    const cb = sinon.spy();
    beforeEach(() => {
      keys.unset('api');
    });
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if no credentials are passed', () => {
      keys.set({ api: 'existing-key' });
      expect(() => authorize()).to.throw(Error, 'No credentials passed!');
    });

    it('should throw an error if API key is already set', () => {
      keys.set({ api: 'existing-key' });
      expect(() => authorize({ username: 'test', password: 'test' })).to.throw(Error, 'API key already set!');
    });

    it('should make a GET request to /profile.json', () => {
      authorize({ username: 'test', password: 'test' }, () => {});
      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/profile.json?lang=en');
    });

    it('should call cb with unprocessable error if statusCode is 401 and body is present', () => {
      const opts = { username: 'testuser', password: 'password' };
      const resp = { statusCode: 401, body:  { error: ['some error!'] } };
    
      requestStub.callsFake((url, options, callback) => {
        expect(url).to.equal('/profile.json?lang=en');
        expect(options).to.deep.equal(opts);
        callback(null, resp);
      });
      authorize(opts, cb);
      const expectedError = errors.unprocessable('some error!');
      const actualError = cb.args[0][0];
      const expectedMessage = expectedError.message.replace(/[\r\n]+/g, ' ').trim();
      const actualMessage = actualError.message.replace(/[\r\n]+/g, ' ').trim();
      expect(actualMessage).to.equal(expectedMessage);
    });
    
    it('should call cb with INVALID_CREDENTIALS error if statusCode is 401 and body is absent', () => {
      const opts = { username: 'testuser', password: 'password' };
      const resp = { statusCode: 401 };
  
      requestStub.callsFake((url, options, callback) => callback(null, resp));
      authorize(opts, cb);
      const expectedError = errors.get('INVALID_CREDENTIALS');
      const actualError = cb.args[0][0];
      const expectedMessage = expectedError.message.replace(/[\r\n]+/g, ' ').trim();
      const actualMessage = actualError.message.replace(/[\r\n]+/g, ' ').trim();
      expect(actualMessage).to.equal(expectedMessage);
    });
  
    it('should call cb with null and body.key if body.key is present', () => {
      const opts = { username: 'testuser', password: 'password' };
      const resp = { body: { key: 'some-key' } };
  
      requestStub.callsFake((url, options, callback) => callback(null, resp));
      authorize(opts, cb);
  
      expect(cb.calledWith(null, 'some-key')).to.be.true;
    });
  
    it('should call cb with null and body.user.key if body.user.key is present', () => {
      const opts = { username: 'testuser', password: 'password' };
      const resp = { body: { user: { key: 'user-key' } } };
  
      requestStub.callsFake((url, options, callback) => callback(null, resp));
      authorize(opts, cb);
  
      expect(cb.calledWith(null, 'user-key')).to.be.true;
    });
  
    it('should call cb with unknown error for unexpected responses', () => {
      const opts = { username: 'testuser', password: 'password' };
      const resp = { statusCode: 500, body: { error: 'Some server error' } };
  
      requestStub.callsFake((url, options, callback) => callback(null, resp));
      authorize(opts, cb);
      const expectedError = errors.unknown(resp);
      const actualError = cb.args[0][0];
      const expectedMessage = expectedError.message.replace(/[\r\n]+/g, ' ').trim();
      const actualMessage = actualError.message.replace(/[\r\n]+/g, ' ').trim();
      expect(actualMessage).to.equal(expectedMessage);
    });
  });

  describe('signup', () => {
    it('should throw an error if empty data is passed', () => {
      expect(() => signup()).to.throw(Error, 'Empty data.');
    });

    it('should throw an error if API key is already set', () => {
      keys.set({ api: 'existing-key' });
      expect(() => signup({ username: 'user', password: 'pass' })).to.throw(Error, 'API key already set!');
    });

    /* it('should validate data using the validate function', () => {
      const validateStub = sinon.stub(auth, 'validate');
      validateStub.returns('Error message');
      signup({ policy_rule_privacy_terms: true }, (err) => {
        expect(err).to.be.an.instanceof(errors.validation);
        expect(err.message).to.equal('Error message');
      });
    });

    it('should make a POST request to /signup.json', () => {
      const requestStub = sinon.stub(request, 'post');
      signup({ policy_rule_privacy_terms: true }, () => {});
      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/signup.json?lang=en');
    });

    it('should handle 422 response', () => {
      const requestStub = sinon.stub(request, 'post');
      requestStub.yields(null, { statusCode: 422, body: { error: 'Validation error' } });
      signup({ policy_rule_privacy_terms: true }, (err) => {
        expect(err).to.be.an.instanceof(errors.unprocessable);
        expect(err.message).to.equal('Validation error');
      });
    }); */
  });

  describe('validate function', () => {
    it('should return an error if Terms & Conditions are not accepted', () => {
      const data = { policy_rule_age: true }; // Age rule is set, but not the terms and conditions
      const result = validate(data);
      expect(result).to.equal('You need to accept the Terms & Conditions and Privacy Policy to continue');
    });
  
    it('should return an error if user is under 16 years old', () => {
      const data = { policy_rule_privacy_terms: true }; // Terms accepted but no age rule
      const result = validate(data);
      expect(result).to.equal('You must be older than 16 years old to use Prey');
    });
  
    it('should return undefined if both conditions are met', () => {
      const data = { policy_rule_privacy_terms: true, policy_rule_age: true };
      const result = validate(data);
      expect(result).to.be.undefined; // No error message, validation passes
    });
  });
});