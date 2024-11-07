/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const {
  isBoolean, removeBackslash, getInformationChannel, stringBooleanOrEmpty,
  splitGfromString, getChannelDifFormat,
} = require('../../../../lib/agent/utils/utilsprey');

describe('Utility functions', () => {
  describe('isBoolean', () => {
    it('should return true for boolean true', () => {
      expect(isBoolean(true)).to.be.true;
    });

    it('should return false for boolean false', () => {
      expect(isBoolean(false)).to.be.false;
    });

    it('should return true for string "true"', () => {
      expect(isBoolean('true')).to.be.true;
    });

    it('should return false for string "false"', () => {
      expect(isBoolean('false')).to.be.false;
    });

    it('should return false for any other string', () => {
      expect(isBoolean('hello')).to.be.false;
    });

    it('should return false for any other type', () => {
      expect(isBoolean(123)).to.be.false;
    });
  });

  describe('stringBooleanOrEmpty', () => {
    it('should return empty string for undefined', () => {
      expect(stringBooleanOrEmpty(undefined)).to.be.empty;
    });

    it('should return empty string for null', () => {
      expect(stringBooleanOrEmpty(null)).to.be.empty;
    });

    it('should return empty string for empty string', () => {
      expect(stringBooleanOrEmpty('')).to.be.empty;
    });

    it('should return "true" for boolean true', () => {
      expect(stringBooleanOrEmpty(true)).to.equal('true');
    });

    it('should return "false" for boolean false', () => {
      expect(stringBooleanOrEmpty(false)).to.equal('false');
    });

    it('should return "true" for string "true"', () => {
      expect(stringBooleanOrEmpty('true')).to.equal('true');
    });

    it('should return "false" for string "false"', () => {
      expect(stringBooleanOrEmpty('false')).to.equal('false');
    });

    it('should return empty string for any other string', () => {
      expect(stringBooleanOrEmpty('hello')).to.be.empty;
    });

    it('should return empty string for any other type', () => {
      expect(stringBooleanOrEmpty(123)).to.be.empty;
    });
  });

  describe('splitGfromString', () => {
    it('should return the original string if it does not contain "g"', () => {
      expect(splitGfromString('hello')).to.equal('hello');
    });

    it('should return the number after "g" if it exists', () => {
      expect(splitGfromString('hello g123')).to.equal('123');
    });

    it('should return the original string if "g" is not followed by a number', () => {
      expect(splitGfromString('hello gabc')).to.equal('hello gabc');
    });
  });

  describe('getChannelDifFormat', () => {
    it('should return the original string if it does not contain "("', () => {
      expect(getChannelDifFormat('hello')).to.equal('hello');
    });

    it('should return the string before "(" if it exists', () => {
      expect(getChannelDifFormat('hello (world)')).to.equal('hello');
    });

    it('should return the original string if "(" is not followed by a string', () => {
      expect(getChannelDifFormat('hello (123)')).to.equal('hello');
    });
  });

  describe('getInformationChannel', () => {
    it('should return the original string if it does not contain a number followed by " ("', () => {
      expect(getInformationChannel('hello')).to.equal('hello');
    });

    it('should return the number before " (" if it exists', () => {
      expect(getInformationChannel('123 (hello)')).to.equal('123');
    });

    it('should return the original string if the number is not followed by " ("', () => {
      expect(getInformationChannel('123 hello')).to.equal('123 hello');
    });
  });

  describe('removeBackslash', () => {
    it('should return the original string if it does not contain backslashes', () => {
      expect(removeBackslash('hello')).to.equal('hello');
    });

    it('should return the string with backslashes removed', () => {
      expect(removeBackslash('hello\\world')).to.equal('helloworld');
    });
  });
});
