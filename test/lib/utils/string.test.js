'use strict';

const { expect } = require('chai');
const { cleanString } = require('../../../lib/utils/string');

describe('lib/utils/string', () => {
  describe('cleanString', () => {
    it('replaces special characters with underscores', () => {
      expect(cleanString("O'Brien")).to.equal('O_Brien');
    });

    it('replaces dollar signs with underscores', () => {
      expect(cleanString('svc_prey$')).to.equal('svc_prey_');
    });

    it('leaves alphanumeric characters and spaces intact', () => {
      expect(cleanString('John Doe 123')).to.equal('John Doe 123');
    });

    it('trims leading and trailing whitespace', () => {
      expect(cleanString('  testuser  ')).to.equal('testuser');
    });

    it('replaces semicolons and other PowerShell metacharacters', () => {
      expect(cleanString('user;drop')).to.equal('user_drop');
    });

    it('returns empty string when input is only special characters', () => {
      expect(cleanString("'$;")).to.equal('___');
    });
  });
});
