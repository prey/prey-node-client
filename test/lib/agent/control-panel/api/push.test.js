const { expect } = require('chai');
const sinon = require('sinon');
const keys = require('../../../../../lib/agent/control-panel/api/keys');
const request = require('../../../../../lib/agent/control-panel/api/request');
const common = require('../../../../../lib/agent/common');
const push = require('../../../../../lib/agent/control-panel/api/push');

describe('Module Tests', () => {
  let keysStub, requestStub;

  beforeEach(() => {
    keysStub = sinon.stub(keys, 'get');
    requestStub = sinon.stub(request, 'post');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('checkKeys', () => {
    it('should throw an error if keys are not present', () => {
      sinon.stub(keys, 'present').returns(false);
      try {
        push.response({}, {}, () => {});
      } catch (err) {
        expect(err.message).to.equal('Both API and Device keys are needed.');
      }
    });
  });

  describe('formatUrl', () => {
    it('should format the URL correctly', () => {
      keysStub.returns({ device: '12345' });
      const formatUrl = push.formatUrl;
      const result = formatUrl('events');
      expect(result).to.equal('/devices/12345/events.json');
    });
  });

  describe('post', () => {
    it('should set the X-Prey-Status header if status is provided', () => {
      const options = { status: { active: true } };
      const data = {};
      const cb = sinon.spy();

      push.post('/test', data, options, cb);

      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][2]).to.have.property('headers');
      expect(requestStub.args[0][2].headers['X-Prey-Status']).to.equal(JSON.stringify({ active: true }));
    });

    it('should set the user_agent if not provided', () => {
      sinon.stub(common.system, 'user_agent').value('TestAgent');
      const options = {};
      const data = {};
      const cb = sinon.spy();

      push.post('/test', data, options, cb);

      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][2].user_agent).to.equal('TestAgent');
    });

    it('should call request.post with correct arguments', () => {
      const data = { key: 'value' };
      const options = { user_agent: 'custom-agent' };
      const cb = sinon.spy();

      push.post('/test', data, options, cb);

      expect(requestStub.calledOnceWith('/test', data, options, cb)).to.be.true;
    });
  });

  describe('API Methods', () => {
    beforeEach(() => {
      sinon.stub(keys, 'present').returns(true);
      keysStub.returns({ device: '12345' });
    });

    it('response should call post with the correct URL', () => {
      const data = {};
      const options = {};
      const cb = sinon.spy();

      push.response(data, options, cb);

      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/devices/12345/response.json');
    });

    it('event should call post with the correct URL', () => {
      const data = {};
      const options = {};
      const cb = sinon.spy();

      push.event(data, options, cb);

      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/devices/12345/events.json');
    });

    it('report should call post with the correct URL', () => {
      const data = {};
      const options = {};
      const cb = sinon.spy();

      push.report(data, options, cb);

      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/devices/12345/reports.json');
    });

    it('data should call post with the correct URL', () => {
      const dta = {};
      const options = {};
      const cb = sinon.spy();

      push.data(dta, options, cb);

      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.args[0][0]).to.equal('/devices/12345/data.json');
    });
  });
});
