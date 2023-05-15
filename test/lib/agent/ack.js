const {
  describe, it, before, after,
} = require('mocha');
const should = require('should');
const { tmpdir } = require('os');
const ack = require('../../../lib/agent/ack');
const storage = require('../../../lib/agent/utils/storage');

describe('validation ack acknowledge', () => {
  describe('validation if json is valid', () => {
    it('there is no key ack_id in the json', (done) => {
      ack.processAck({}, (err) => {
        should.exist(err);
        err.message.should.containEql('there is no key ack_id in the json');
        done();
      });
    });
  });
  describe('with no keys stored', () => {
    before((done) => {
      storage.init('ack', `${tmpdir()}/storeAck.db`, () => {
        storage.do(
          'set',
          { type: 'ack', id: '1', data: { id: '1', type: 'ack', retries: 0 } },
          () => {
            done();
          },
        );
      });
    });
    it('there is ackId = 1', (done) => {
      ack.verifyIfExistId('1', (err, exist) => {
        should.not.exist(err);
        exist.should.equal(true);
        done();
      });
    });
    it('there is not ackId = 2', (done) => {
      ack.verifyIfExistId('2', (err, exist) => {
        should.not.exist(err);
        exist.should.equal(false);
        done();
      });
    });
    it('process ack and register', (done) => {
      ack.processAck({ type: 'ack', ack_id: '3', retries: 0 }, (err, registeredJson) => {
        should.not.exist(err);
        JSON.stringify(registeredJson).should.equal(JSON.stringify({ ack_id: '3', type: 'ack', retries: 0 }));
        done();
      });
    });

    after((done) => {
      storage.erase(`${tmpdir()}/storeAck.db`, done);
    });
  });
});
