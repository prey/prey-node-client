const { expect } = require('chai');
const sinon = require('sinon');
const logger = require('../../../../../lib/agent/control-panel/api/logger');
const request = require('../../../../../lib/agent/control-panel/api/request');
const index = require('../../../../../lib/agent/control-panel/api/index'); // Adjust this path

describe('Module Exports and use Function', () => {
  
  describe('Module Exports', () => {
    it('should export logger, keys, accounts, devices, and push modules', () => {
      expect(index.logger).to.exist;
      expect(index.keys).to.exist;
      expect(index.accounts).to.exist;
      expect(index.devices).to.exist;
      expect(index.push).to.exist;
    });
  });

  describe('use function', () => {
    let loggerUseStub;
    let requestUseStub;

    beforeEach(() => {
      loggerUseStub = sinon.stub(logger, 'use');
      requestUseStub = sinon.stub(request, 'use');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should call logger.use with a custom logger when provided', () => {
      const customLogger = { log: () => {} };
      index.use({ logger: customLogger });

      expect(loggerUseStub.calledOnceWith(customLogger)).to.be.true;
    });

    it('should call request.use with the object when provided', () => {
      const customRequestClient = { request: () => {} };
      index.use({ request: customRequestClient });

      expect(requestUseStub.calledOnceWith({ request: customRequestClient })).to.be.true;
    });

    it('should not call logger.use if no custom logger is provided', () => {
      index.use({});
      expect(loggerUseStub.notCalled).to.be.true;
    });
  });
});
