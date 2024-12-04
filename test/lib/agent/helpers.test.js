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
    it('debería regresar true si se está ejecutando en segundo plano', () => {
      sinon.stub(helpers, 'run_via_service').returns(true);
      sinon.stub(helpers, 'no_console_attached').returns(true);
      expect(helpers.running_on_background()).to.be.true;
    });

    it('debería regresar false si no se está ejecutando en segundo plano', () => {
      sinon.stub(helpers, 'run_via_service').returns(false);
      sinon.stub(helpers, 'no_console_attached').returns(false);
      expect(helpers.running_on_background()).to.be.false;
    });
  });

  describe('greaterOrEqual', () => {
    it('debería regresar true si la versión es mayor o igual', () => {
      expect(helpers.greaterOrEqual('1.2.3', '1.2.2')).to.be.true;
    });

    it('debería regresar false si la versión es menor', () => {
      expect(helpers.greaterOrEqual('1.2.2', '1.2.3')).to.be.false;
    });

    it('debería regresar false si la versión es menor', () => {
      expect(helpers.greaterOrEqual('10.2.2', '1.2.3')).to.be.false;
    });

    it('debería regresar false si la versión es menor', () => {
      expect(helpers.greaterOrEqual('1.2.2', '10.2.3')).to.be.false;
    });

    it('debería regresar false si la versión es menor', () => {
      expect(helpers.greaterOrEqual('10.2.2', '10.2.3')).to.be.false;
    });

    it('debería regresar false si la versión es menor', () => {
      expect(helpers.greaterOrEqual('1.20.2', '1.20.3')).to.be.false;
    });

    it('debería regresar false si la versión es menor', () => {
      expect(helpers.greaterOrEqual('1.2.20', '1.2.30')).to.be.false;
    });
  });

  describe('semverWrapper', () => {
    it('debería regresar el resultado de la función de semver', () => {
      const methodName = 'gt';
      const first = '1.2.3';
      const second = '1.2.2';
      const result = helpers.semverWrapper(methodName, first, second);
      expect(result).to.be.true;
    });

    it('debería fallar el resultado de la función de semver', () => {
      const methodName = 'gt';
      const first = '1.2.3';
      const second = '1xx';
      const result = helpers.semverWrapper(methodName, first, second);
      expect(result).to.be.false;
    });
  });

  describe('is_greater_than', () => {
    it('debería regresar true si la versión es mayor', () => {
      expect(helpers.is_greater_than('1.2.3', '1.2.2')).to.be.true;
    });

    it('debería regresar false si la versión es menor o igual', () => {
      expect(helpers.is_greater_than('1.2.2', '1.2.3')).to.be.false;
    });
  });

  describe('is_greater_or_equal', () => {
    it('debería regresar true si la versión es mayor o igual', () => {
      expect(helpers.is_greater_or_equal('1.2.3', '1.2.2')).to.be.true;
    });

    it('debería regresar false si la versión es menor', () => {
      expect(helpers.is_greater_or_equal('1.2.2', '1.2.3')).to.be.false;
    });
  });
});
