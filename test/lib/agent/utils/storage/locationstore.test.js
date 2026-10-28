/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const storage = require('../../../../../lib/agent/utils/storage');
const locationstore = require('../../../../../lib/agent/utils/storage/locationstore');

describe('locationstore', () => {
  let storageDoStub;

  beforeEach(() => {
    storageDoStub = sinon.stub(storage, 'do');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('stampLocation', () => {
    it('adds a recorded_at ISO timestamp without mutating the original', () => {
      const original = { lat: 1, lng: 2, method: 'wifi' };
      const stamped = locationstore.stampLocation(original);
      expect(stamped.recorded_at).to.be.a('string');
      expect(new Date(stamped.recorded_at).toISOString()).to.equal(stamped.recorded_at);
      expect(stamped).to.include({ lat: 1, lng: 2, method: 'wifi' });
      expect(original).to.not.have.property('recorded_at');
    });
  });

  describe('recordLocation', () => {
    it('inserts a row with recorded_at, mapped fields and returns the id', (done) => {
      const location = {
        lat: 10.5, lng: -20.25, accuracy: 42, method: 'native', position_source: 'gps',
      };
      storageDoStub.callsFake((operation, payload, cb) => {
        if (operation === 'set') {
          expect(payload.type).to.equal('locations');
          expect(payload.id).to.equal('fixed-id');
          expect(payload.data).to.include({
            id: 'fixed-id', lat: 10.5, lng: -20.25, accuracy: 42, method: 'native', source: 'gps',
          });
          expect(payload.data.recorded_at).to.be.a('string');
          expect(payload.data.sent).to.equal(0);
          return cb(null);
        }
        if (operation === 'all') return cb(null, []); // prune: nothing to drop
        return cb(null);
      });

      const returnedId = locationstore.recordLocation(
        location,
        { id: 'fixed-id', send_type: 'force', delta: 15 },
        (err, id) => {
          expect(err).to.equal(null);
          expect(id).to.equal('fixed-id');
          done();
        },
      );
      expect(returnedId).to.equal('fixed-id');
    });

    it('generates a uuid when no id is supplied', () => {
      storageDoStub.callsFake((operation, payload, cb) => {
        if (operation === 'all') return cb(null, []);
        return cb(null);
      });
      const id = locationstore.recordLocation({ lat: 1, lng: 2 }, { send_type: 'interval' });
      expect(id).to.be.a('string').with.length.greaterThan(0);
    });

    it('prunes the oldest rows when the table exceeds MAX_LOCATION_ROWS', (done) => {
      const max = locationstore.MAX_LOCATION_ROWS;
      const rows = Array.from({ length: max + 2 }, (_, i) => ({
        id: `row-${i}`,
        recorded_at: new Date(2020, 0, 1, 0, 0, i).toISOString(),
      }));
      const deleted = [];
      storageDoStub.callsFake((operation, payload, cb) => {
        if (operation === 'set') return cb(null);
        if (operation === 'all') return cb(null, rows);
        if (operation === 'del') {
          deleted.push(payload.id);
          return cb(null);
        }
        return cb(null);
      });

      locationstore.recordLocation({ lat: 1, lng: 2 }, { id: 'new' }, () => {
        // The two oldest rows (row-0, row-1) must be removed.
        expect(deleted).to.deep.equal(['row-0', 'row-1']);
        done();
      });
    });
  });

  describe('markSent', () => {
    it('updates sent=1 and send_type for the row', (done) => {
      storageDoStub.callsFake((operation, payload, cb) => {
        expect(operation).to.equal('update');
        expect(payload.type).to.equal('locations');
        expect(payload.id).to.equal('abc');
        expect(payload.columns).to.deep.equal(['sent', 'send_type']);
        expect(payload.values).to.deep.equal([1, 'force']);
        cb(null);
      });
      locationstore.markSent('abc', 'force', () => {
        expect(storageDoStub.calledOnce).to.be.true;
        done();
      });
    });

    it('is a no-op when id is missing', (done) => {
      locationstore.markSent(null, 'force', () => {
        expect(storageDoStub.called).to.be.false;
        done();
      });
    });
  });

  describe('getLocations', () => {
    it('returns rows sorted by recorded_at ascending', (done) => {
      const rows = [
        { id: 'b', recorded_at: '2024-01-02T00:00:00.000Z' },
        { id: 'a', recorded_at: '2024-01-01T00:00:00.000Z' },
        { id: 'c', recorded_at: '2024-01-03T00:00:00.000Z' },
      ];
      storageDoStub.callsFake((operation, payload, cb) => {
        expect(operation).to.equal('all');
        expect(payload.type).to.equal('locations');
        cb(null, rows);
      });
      locationstore.getLocations((err, sorted) => {
        expect(err).to.equal(null);
        expect(sorted.map((r) => r.id)).to.deep.equal(['a', 'b', 'c']);
        done();
      });
    });

    it('propagates errors', (done) => {
      storageDoStub.callsFake((operation, payload, cb) => cb(new Error('boom')));
      locationstore.getLocations((err) => {
        expect(err).to.be.an('error');
        done();
      });
    });
  });
});
