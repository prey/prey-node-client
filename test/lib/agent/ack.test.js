/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const ack = require('../../../lib/agent/ack');

describe('ack testing', () => {
  describe('existKeyAckInJson', () => {
    it('debería regresar true si el objeto tiene una propiedad ack_id', () => {
      const json = { ack_id: '123' };
      expect(ack.existKeyAckInJson(json)).to.be.true;
    });

    it('debería regresar false si el objeto no tiene una propiedad ack_id', () => {
      const json = { foo: 'bar' };
      expect(ack.existKeyAckInJson(json)).to.be.false;
    });
  });

  describe('existKeyIdInJson', () => {
    it('debería regresar true si el objeto tiene una propiedad id', () => {
      const json = { id: '123' };
      expect(ack.existKeyIdInJson(json)).to.be.true;
    });

    it('debería regresar false si el objeto no tiene una propiedad id', () => {
      const json = { foo: 'bar' };
      expect(ack.existKeyIdInJson(json)).to.be.false;
    });
  });
  describe('processAck', () => {
    it('should return an error if json does not have ack_id', (done) => {
      const json = { foo: 'bar' };
      ack.processAck(json, (err, result) => {
        expect(err).to.be.an('error');
        expect(err.message).to.equal('there is no key ack_id in the json');
        expect(result).to.be.undefined;
        done();
      });
    });
    it('should return the expected object if json has ack_id', (done) => {
      const json = { ack_id: '123', id: '456' };
      ack.processAck(json, (err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal({
          ack_id: '123',
          type: 'ack',
          id: '456',
        });
        done();
      });
    });
    it('should return the expected object if json has ack_id but does not have id', (done) => {
      const json = { ack_id: '123' };
      ack.processAck(json, (err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal({
          ack_id: '123',
          type: 'ack',
          id: '',
        });
        done();
      });
    });
  });
});
