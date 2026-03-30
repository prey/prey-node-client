const { expect } = require('chai');
const header = require('../../../../lib/agent/utils/header');

describe('Header Utils', () => {
  describe('sanitizeHeaderValue', () => {
    it('should allow valid ASCII characters', () => {
      const input = 'Hello World (test)';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('Hello World (test)');
    });

    it('should remove newline characters', () => {
      const input = 'Line1\nLine2';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('Line1Line2');
    });

    it('should remove tab characters (control char)', () => {
      const input = 'Before\x00After';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('BeforeAfter');
    });

    it('should keep HTAB (0x09) characters', () => {
      const input = 'Before\tAfter';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('Before\tAfter');
    });

    it('should keep space characters', () => {
      const input = 'Hello World Test';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('Hello World Test');
    });

    it('should remove non-ASCII unicode characters', () => {
      const input = 'User: João';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('User: Joo');
    });

    it('should remove control characters', () => {
      const input = 'Start\r\nEnd';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('StartEnd');
    });

    it('should handle JSON with special characters', () => {
      const input = '{"user":"Admin\nName","status":"active"}';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('{"user":"AdminName","status":"active"}');
    });

    it('should return empty string for non-string input', () => {
      expect(header.sanitizeHeaderValue(null)).to.equal('');
      expect(header.sanitizeHeaderValue(undefined)).to.equal('');
      expect(header.sanitizeHeaderValue(123)).to.equal('');
    });

    it('should handle JSON with complex nested data', () => {
      const statusObj = {
        logged_user: 'Admin\nUser',
        active_access_point: 'WiFi_Network\t2.4GHz',
        battery_status: 'charging',
      };
      const jsonString = JSON.stringify(statusObj);
      const result = header.sanitizeHeaderValue(jsonString);
      // Verify no invalid characters remain
      const invalidChars = result.split('').filter((char) => {
        const code = char.charCodeAt(0);
        return !((code >= 0x21 && code <= 0x7E) || code === 0x20 || code === 0x09);
      });
      expect(invalidChars).to.be.empty;
    });

    it('should preserve special valid characters like colons and braces', () => {
      const input = '{"name":"test","value":123}';
      const result = header.sanitizeHeaderValue(input);
      expect(result).to.equal('{"name":"test","value":123}');
    });
  });
});
