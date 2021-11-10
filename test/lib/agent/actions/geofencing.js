var helpers     = require('./../../../helpers'),
    should      = require('should'),
    sinon       = require('sinon'),
    join        = require('path').join,
    tmpdir      = require('os').tmpdir,
    lib_path    = helpers.lib_path(),
    geof_path   = join(lib_path, 'agent', 'actions', 'geofencing'),
    api_path    = join(lib_path, 'agent', 'plugins', 'control-panel', 'api');
    geofencing  = require(geof_path),
    request     = require(join(api_path, 'request')),
    push        = require(join(api_path, 'push')),
    keys        = require(join(api_path, 'keys')),
    storage     = require(join(lib_path, 'agent', 'utils', 'storage'));

const { v4: uuidv4 } = require('uuid');
var id = uuidv4();

var fences = [
    { id: 1,
      name: 'oeoe',
      lat: '-33.3333333333',
      lng: '-70.1111111111',
      radius: 500,
      key: 'bbbbbb',
      notifications_in: true,
      notifications_out: true },
    { id: 2,
      name: 'prey',
      lat: '0.00000000000',
      lng: '-9.9999999999',
      radius: 100,
      key: 'bbbbbb',
      notifications_in: true,
      notifications_out: true },
    { id: 3,
      name: 'home',
      lat: '3.3333333333',
      lng: '-9.9999999999',
      radius: 1000,
      key: 'bbbbbb',
      notifications_in: true,
      notifications_out: true }
];

var fences2 = [
  { id: 1,
    name: 'oeoe',
    lat: '-33.3333333333',
    lng: '-70.1111111111',
    radius: 500,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
  { id: 2,
    name: 'prey',
    lat: '0.00000000000',
    lng: '-9.9999999999',
    radius: 100,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
  { id: 3,
    name: 'home',
    lat: '3.3333333333',
    lng: '-9.9999999999',
    radius: 1000,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
  { id: 4,
    name: 'another place',
    lat: '3.000000000',
    lng: '-10.9999999999',
    radius: 1000,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
  { id: 5,
    name: 'school',
    lat: '1.00000000',
    lng: '-101.111111',
    radius: 1000,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
];

var fences3 = [
  { id: 1,
    name: 'oeoe',
    lat: '-33.3333333333',
    lng: '-70.1111111111',
    radius: 500,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
  { id: 5,
    name: 'school',
    lat: '1.00000000',
    lng: '-101.111111',
    radius: 1000,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
  { id: 6,
    name: 'park',
    lat: '100.00000000',
    lng: '99.111111',
    radius: 1000,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true }
];

var fences4 = [
  { id: 789,
    name: 'blah',
    lat: '-33.3333333333',
    lng: '-70.1111111111',
    radius: 500,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true },
  { id: 850,
    name: 'meh',
    lat: '1.00000000',
    lng: '-101.111111',
    radius: 1000,
    key: 'bbbbbb',
    notifications_in: true,
    notifications_out: true }
];

var fences5 = [];

describe('geofencing', function() {

  describe('start', function() {

    before(function() {
      keys_present_stub = sinon.stub(keys, 'present').callsFake(() => {
        return true;
      })
      keys_get_stub = sinon.stub(keys, 'get').callsFake(() => {
        return { api: 'aaaaaaaaaa', device: 'bbbbbb' }
      })
    })

    after(function() {
      keys_present_stub.restore();
      keys_get_stub.restore();
    })

    describe('when the request does not return the fences', function() {
      before(function() {
        spy_sync = sinon.spy(geofencing, 'sync');
        get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
          return cb(null, null);
        })
      })

      after(function() {
        get_stub.restore();
        spy_sync.restore();
      })

      it('does no call sync', function(done) {
        geofencing.start(id, {}, function() {
          spy_sync.notCalled.should.be.equal(true);
          done();
        })
      })
    })

    describe('when the fences obtained are valid', function() {

      before((done) => {
        storage.init('keys', tmpdir() + '/geofences.db', done);
      })

      after((done) => {
        storage.erase(tmpdir() + '/geofences.db', done);
      })

      describe('and theres zero fences', function() {

        before(function() {
          spy_sync = sinon.spy(geofencing, 'sync');
          get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
            return cb(null, {body: []});
          })
        })

        after(function() {
          get_stub.restore();
          spy_sync.restore();
        })

        it('call sync and deletes local fences', function(done) {
          geofencing.start(id, {}, function() {
            storage.do('all', {type: 'geofences'}, (err, rows) => {
              rows.length.should.be.equal(0);
              geofencing.watching.length.should.be.equal(0);
              spy_sync.calledOnce.should.be.equal(true);
              done();
            })
          })
        })

      })

      describe('and theres one or more fences', function() {
        var push_data;

        describe('and theres nothing being watched', function() {
          before(function() {
            push_stub = sinon.stub(push, 'response').callsFake((data, opts, cb) => {
              console.log(data)
              push_data = data
              return true;
            });

            spy_sync = sinon.spy(geofencing, 'sync');
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');

            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
              return cb(null, {body: fences});
            });
          })

          after(function() {
            push_stub.restore();
            spy_sync.restore();
            get_stub.restore();
            spy_store.restore();
            spy_del.restore();
          })

          it('call sync and stores all the zones', function(done) {
            geofencing.start(id, {}, function() {
              geofencing.watching[0].should.be.equal(1);
              geofencing.watching[1].should.be.equal(2);
              geofencing.watching[2].should.be.equal(3);
              spy_sync.calledOnce.should.be.equal(true);

              storage.do('all', {type: 'geofences'}, (err, rows) => {
                should.not.exist(err);
                rows.length.should.be.equal(3);
                rows[0].name.should.be.equal('oeoe');
                rows[1].name.should.be.equal('prey');
                rows[2].name.should.be.equal('home');
                done();
              });
            })
          })

          it('does notify to control panel', function(done) {
            push_data.reason.should.exist;
            push_data.reason.should.be.equal('[1,2,3]')
            done();
          })
        })

        describe('and theres new fences compared with the stored', function() {
          before(function() {
            push_stub = sinon.stub(push, 'response').callsFake((data, opts, cb) => {
              console.log(data)
              push_data = data
              return true;
            });

            spy_sync = sinon.spy(geofencing, 'sync');
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');

            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
              return cb(null, {body: fences2});
            });
          })

          after(function() {
            push_stub.restore();
            spy_sync.restore();
            spy_store.restore();
            spy_del.restore();
            get_stub.restore();
          })

          it('call sync and stores the new zones', function(done) {
            storage.do('all', {type: 'geofences'}, (err, rows) => {
              rows.length.should.be.equal(3);  // from last test
              geofencing.start(id, {}, function() {
                spy_sync.calledOnce.should.be.equal(true);
                geofencing.watching[0].should.be.equal(1);
                geofencing.watching[1].should.be.equal(2);
                geofencing.watching[2].should.be.equal(3);
                geofencing.watching[3].should.be.equal(4);
                geofencing.watching[4].should.be.equal(5);

                storage.do('all', {type: 'geofences'}, (err, rows) => {
                  rows.length.should.be.equal(5);
                  rows[0].name.should.be.equal('oeoe');
                  rows[1].name.should.be.equal('prey');
                  rows[2].name.should.be.equal('home');
                  rows[3].name.should.be.equal('another place');
                  rows[4].name.should.be.equal('school');
                  done();
                });
              })
            });
          })

          it('does notify to control panel', function(done) {
            push_data.reason.should.exist;
            push_data.reason.should.be.equal('[1,2,3,4,5]')
            done();
          })
        });

        describe('and theres less fences compared with the stored and one new', function() {
          before(function() {
            push_stub = sinon.stub(push, 'response').callsFake((data, opts, cb) => {
              console.log(data)
              push_data = data
              return true;
            });

            spy_sync = sinon.spy(geofencing, 'sync');
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');

            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
              return cb(null, {body: fences3});
            });
          })

          after(function() {
            push_stub.restore();
            spy_sync.restore();
            spy_store.restore();
            spy_del.restore();
            get_stub.restore();
          })

          it('call sync, deletes the old zones and stores the new ones', function(done) {
            storage.do('all', {type: 'geofences'}, (err, rows) => {
              rows.length.should.be.equal(5);  // from last test
              geofencing.start(id, {}, function() {
                spy_sync.calledOnce.should.be.equal(true);
                geofencing.watching[0].should.be.equal(1);
                geofencing.watching[1].should.be.equal(5);
                geofencing.watching[2].should.be.equal(6);

                storage.do('all', {type: 'geofences'}, (err, rows) => {
                  rows.length.should.be.equal(3);
                  rows[0].name.should.be.equal('oeoe');
                  rows[1].name.should.be.equal('school');
                  rows[2].name.should.be.equal('park');
                  done();
                });
              })
            });
          })

          it('does notify to control panel', function(done) {
            push_data.reason.should.exist;
            push_data.reason.should.be.equal('[1,5,6]')
            done();
          })
        });

        describe('and theres no new fences comparing with the stored', function() {
          before(function() {
            push_stub = sinon.stub(push, 'response').callsFake((data, opts, cb) => {
              console.log(data)
              push_data = data
              return true;
            });

            spy_sync = sinon.spy(geofencing, 'sync');
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');

            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
              return cb(null, {body: fences4});
            });
          })

          after(function() {
            push_stub.restore();
            spy_sync.restore();
            spy_store.restore();
            spy_del.restore();
            get_stub.restore();
          })

          it('call sync and stores the new zones', function(done) {
            storage.do('all', {type: 'geofences'}, (err, rows) => {
              rows.length.should.be.equal(3);  // from last test
              geofencing.start(id, {}, function() {
                spy_sync.calledOnce.should.be.equal(true);
                geofencing.watching[0].should.be.equal(789);
                geofencing.watching[1].should.be.equal(850);


                storage.do('all', {type: 'geofences'}, (err, rows) => {
                  rows.length.should.be.equal(2);
                  rows[0].name.should.be.equal('blah');
                  rows[1].name.should.be.equal('meh');
                  done();
                });
              })
            });
          })

          it('does notify to control panel', function(done) {
            push_data.reason.should.exist;
            push_data.reason.should.be.equal('[789,850]')
            done();
          })
        })

        describe('and theres no fences now', function() {
          before(function() {
            push_stub = sinon.stub(push, 'response').callsFake((data, opts, cb) => {
              console.log(data)
              push_data = data
              return true;
            });

            spy_sync = sinon.spy(geofencing, 'sync');
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');

            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
              return cb(null, {body: fences5});
            });
          })

          after(function() {
            push_stub.restore();
            spy_sync.restore();
            spy_store.restore();
            spy_del.restore();
            get_stub.restore();
          })

          it('call sync and stores the new zones', function(done) {
            storage.do('all', {type: 'geofences'}, (err, rows) => {
              rows.length.should.be.equal(2);  // from last test
              geofencing.start(id, {}, function() {
                spy_sync.calledOnce.should.be.equal(true);
                geofencing.watching.length.should.be.equal(0);

                storage.do('all', {type: 'geofences'}, (err, rows) => {
                  rows.length.should.be.equal(0);
                  done();
                });
              })
            });
          })

          it('does notify to control panel', function(done) {
            push_data.reason.should.exist;
            push_data.reason.should.be.equal('[]')
            done();
          })
        })

      })

    })

  })

})
