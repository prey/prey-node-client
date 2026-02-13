/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const helpers = require('../../../lib/agent/helpers');

describe('helpers testing washin', () => {
  describe('running_on_background', () => {
    beforeEach(() => {
      sinon.restore();
    });
    it('should return true if running in background', () => {
      sinon.stub(helpers, 'run_via_service').returns(true);
      sinon.stub(helpers, 'no_console_attached').returns(true);
      expect(helpers.running_on_background()).to.be.true;
    });

    it('should return false if not running in background', () => {
      sinon.stub(helpers, 'run_via_service').returns(false);
      sinon.stub(helpers, 'no_console_attached').returns(false);
      expect(helpers.running_on_background()).to.be.false;
    });
  });

  describe('greaterOrEqual', () => {
    it('should return true if version is greater or equal', () => {
      expect(helpers.greaterOrEqual('1.2.3', '1.2.2')).to.be.true;
    });

    it('should return false if version is less', () => {
      expect(helpers.greaterOrEqual('1.2.2', '1.2.3')).to.be.false;
    });

    it('should return true if version is greater (10.x > 1.x)', () => {
      expect(helpers.greaterOrEqual('10.2.2', '1.2.3')).to.be.true;
    });

    it('should return false if version is less (1.x < 10.x)', () => {
      expect(helpers.greaterOrEqual('1.2.2', '10.2.3')).to.be.false;
    });

    it('should return false if patch version is less', () => {
      expect(helpers.greaterOrEqual('10.2.2', '10.2.3')).to.be.false;
    });

    it('should return false if minor version patch is less', () => {
      expect(helpers.greaterOrEqual('1.20.2', '1.20.3')).to.be.false;
    });

    it('should return false if patch is less with larger numbers', () => {
      expect(helpers.greaterOrEqual('1.2.20', '1.2.30')).to.be.false;
    });
  });

  describe('semverWrapper', () => {
    it('should return semver function result', () => {
      const methodName = 'gt';
      const first = '1.2.3';
      const second = '1.2.2';
      const result = helpers.semverWrapper(methodName, first, second);
      expect(result).to.be.true;
    });

    it('should return false for invalid semver input', () => {
      const methodName = 'gt';
      const first = '1.2.3';
      const second = '1xx';
      const result = helpers.semverWrapper(methodName, first, second);
      expect(result).to.be.false;
    });
  });

  describe('is_greater_than', () => {
    it('should return true if version is greater', () => {
      expect(helpers.is_greater_than('1.2.3', '1.2.2')).to.be.true;
    });

    it('should return false if version is less or equal', () => {
      expect(helpers.is_greater_than('1.2.2', '1.2.3')).to.be.false;
    });
  });

  describe('is_greater_or_equal', () => {
    it('should return true if version is greater or equal', () => {
      expect(helpers.is_greater_or_equal('1.2.3', '1.2.2')).to.be.true;
    });

    it('should return false if version is less', () => {
      expect(helpers.is_greater_or_equal('1.2.2', '1.2.3')).to.be.false;
    });
  });
});
