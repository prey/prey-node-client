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

    // These used to return -1, which is truthy, so a missing os_release
    // silently passed every version gate that called through here.
    it('should return false when the first argument is not a string', () => {
      expect(helpers.greaterOrEqual(undefined, '24.04')).to.be.false;
      expect(helpers.greaterOrEqual(null, '24.04')).to.be.false;
    });

    it('should return false when the second argument is not a string', () => {
      expect(helpers.greaterOrEqual('24.04', undefined)).to.be.false;
    });

    it('should compare zero-padded components numerically', () => {
      expect(helpers.greaterOrEqual('24.04', '24.04')).to.be.true;
      expect(helpers.greaterOrEqual('22.04', '24.04')).to.be.false;
    });
  });

  describe('compareVersions', () => {
    it('should order by component, not lexicographically', () => {
      expect(helpers.compareVersions('10.2.2', '1.2.3')).to.be.greaterThan(0);
      expect(helpers.compareVersions('1.2.2', '10.2.3')).to.be.lessThan(0);
      expect(helpers.compareVersions('1.2.20', '1.2.30')).to.be.lessThan(0);
    });

    it('should pad the shorter version with zeros', () => {
      expect(helpers.compareVersions('10.15', '10.15.0')).to.equal(0);
      expect(helpers.compareVersions('12', '12.0.0')).to.equal(0);
      expect(helpers.compareVersions('10.15.1', '10.15')).to.be.greaterThan(0);
    });

    it('should read zero-padded components as numbers', () => {
      expect(helpers.compareVersions('24.04', '24.4')).to.equal(0);
      expect(helpers.compareVersions('24.04', '24.10')).to.be.lessThan(0);
    });

    // wpxsvc's version arrives as "2.0.35\r" — windows/index.js splits its
    // stdout on '\n' only, so the CR rides along.
    it('should trim surrounding whitespace', () => {
      expect(helpers.compareVersions('2.0.35\r', '2.0.35')).to.equal(0);
      expect(helpers.compareVersions(' 1.2.3 ', '1.2.3')).to.equal(0);
    });

    it('should return null for anything that is not a dotted number', () => {
      expect(helpers.compareVersions('1xx', '1.2.3')).to.be.null;
      expect(helpers.compareVersions('1.2.3', '1xx')).to.be.null;
      expect(helpers.compareVersions('', '1.2.3')).to.be.null;
      expect(helpers.compareVersions('1..2', '1.2.3')).to.be.null;
      expect(helpers.compareVersions(undefined, '1.2.3')).to.be.null;
      expect(helpers.compareVersions(null, '1.2.3')).to.be.null;
    });
  });

  describe('gtkSuffix', () => {
    it('should pick gtk4 from 24.04 on', () => {
      expect(helpers.gtkSuffix('24.04')).to.equal('-gtk4');
      expect(helpers.gtkSuffix('25.04')).to.equal('-gtk4');
      expect(helpers.gtkSuffix('24.10')).to.equal('-gtk4');
    });

    it('should pick gtk3 below 24.04', () => {
      expect(helpers.gtkSuffix('22.04')).to.equal('-gtk3');
      expect(helpers.gtkSuffix('20.04')).to.equal('-gtk3');
    });

    // A string compare put these above '24.04' ('9' > '2'), so old releases
    // were handed the gtk4 binary.
    it('should pick gtk3 for releases that sort above 24.04 as strings', () => {
      expect(helpers.gtkSuffix('9.10')).to.equal('-gtk3');
      expect(helpers.gtkSuffix('8')).to.equal('-gtk3');
    });

    it('should fall back to gtk3 when the release is unknown', () => {
      expect(helpers.gtkSuffix(undefined)).to.equal('-gtk3');
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

    // These used to fall through semver.valid() and answer false without
    // comparing, because two-component strings are not valid semver.
    it('should compare two-component versions instead of giving up', () => {
      expect(helpers.is_greater_than('10.15.0', '10.14')).to.be.true;
      expect(helpers.is_greater_than('10.14.0', '10.13')).to.be.true;
    });

    it('should still answer false for modern macOS release strings', () => {
      expect(helpers.is_greater_than('10.15.0', '15.2')).to.be.false;
      expect(helpers.is_greater_than('10.15.0', '26.6')).to.be.false;
      expect(helpers.is_greater_than('10.14.0', '14.5.1')).to.be.false;
    });

    it('should return false for unparseable input', () => {
      expect(helpers.is_greater_than('1.2.3', '1xx')).to.be.false;
      expect(helpers.is_greater_than(undefined, '1.2.3')).to.be.false;
    });
  });

  describe('is_greater_or_equal', () => {
    it('should return true if version is greater or equal', () => {
      expect(helpers.is_greater_or_equal('1.2.3', '1.2.2')).to.be.true;
    });

    it('should return false if version is less', () => {
      expect(helpers.is_greater_or_equal('1.2.2', '1.2.3')).to.be.false;
    });

    it('should compare two-component versions instead of giving up', () => {
      expect(helpers.is_greater_or_equal('15.2', '13.0.0')).to.be.true;
      expect(helpers.is_greater_or_equal('11.0', '13.0.0')).to.be.false;
    });

    // Regression guard: the winsvc version reaches these gates with a trailing
    // CR, and dropping it would silently strip tpm_module from the specs report.
    it('tolerates the trailing CR that wpxsvc output leaves behind', () => {
      expect(helpers.is_greater_or_equal('2.0.35\r', '2.0.0')).to.be.true;
    });

    it('should keep answering correctly for the windows NT version', () => {
      expect(helpers.is_greater_or_equal('10.0.26100', '10.0.0')).to.be.true;
      expect(helpers.is_greater_or_equal('6.1.7601', '10.0.0')).to.be.false;
    });
  });
});
