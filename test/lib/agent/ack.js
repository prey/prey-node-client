const {
  describe, it, before, after,
} = require('mocha');
const should = require('should');
const sinon = require('sinon');
const ack = require('../../../lib/agent/ack');
const websocket = require('../../../lib/agent/plugins/control-panel/websockets');

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
  describe('validation if json is valid', () => {
    it('process ack and register', (done) => {
      ack.processAck({
        ack_id: '3', type: 'ack', id: '1234',
      }, (err, registeredJson) => {
        should.not.exist(err);
        JSON.stringify(registeredJson).should.equal(JSON.stringify({
          ack_id: '3', type: 'ack', id: '1234',
        }));
        done();
      });
    });
  });
  describe('send to server ack', () => {
    let websocketStub = null;
    websocket.responsesAck.push({
      ack_id: '3',
      type: 'ack',
      id: '1',
      sent: false,
      retries: 0,
    });
    before(() => {
      websocketStub = sinon.stub(websocket, 'sendAckToServer').callsFake(() => '');
    });

    after(() => {
      websocketStub.restore();
    });

    it('notify ack', (done) => {
      websocket.notifyAck('3,', 'ack', false, 0);
      done();
    });
  });
});
