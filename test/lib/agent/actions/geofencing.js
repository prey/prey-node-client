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
    storage2     = require(join(lib_path, 'agent', 'utils', 'commands_storage'));
    //storage     = require(join(lib_path, 'agent', 'utils', 'storage'));

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

var local_fences = {
  'geofence-1': { id: 1, name: 'oeoe', state: 'outside' }
}

var local_fences_2 = {
  'geofence-1': { id: 1, name: 'oeoe', state: 'outside' },
  'geofence-2': { id: 1, name: 'prey', state: 'inside' },
  'geofence-3': { id: 1, name: 'home', state: 'outside' }
}

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
          return cb(null, []);
        })
      })

      after(function() {
        get_stub.restore();
        spy_sync.restore();
      })

      it('does no call sync', function(done) {
        geofencing.start({}, function() {
          console.log("COUNT", spy_sync.callCount)
          spy_sync.notCalled.should.be.equal(true);
          done();
        })
      })
    })

    describe('when the fences obtained are valid', function() {

      before((done) => {
        storage2.init('keys', tmpdir() + '/geofences.db', done);
      })

      after((done) => {
        storage2.erase(tmpdir() + '/geofences.db', done);
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
          console.log("STORAGE!!", storage2)
          geofencing.start({}, function() {
            storage2.do('all', {type: 'geofences'}, (err, rows) => {
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
        // before(function() {
        //   get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
        //     return cb(null, {body: fences});
        //   });
        //   // store_stub = sinon.stub(storage, 'do').callsFake((key, opts, cb) => {
        //   //   //return cb();
        //   // })

          
        // })

        // after(function() {
        //   // store_stub.restore();
        //   get_stub.restore();
        // })

        describe('and theres nothing being watched', function() {
          before(function() {
            push_stub = sinon.stub(push, 'response').callsFake((data, opts, cb) => {
              console.log(data)
              push_data = data
              return true;
            });

            spy_sync = sinon.spy(geofencing, 'sync');
            spy_store = sinon.spy(storage2.storage_fns, 'set');
            spy_del = sinon.spy(storage2.storage_fns, 'del');

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
            geofencing.start({}, function() {
              geofencing.watching[0].should.be.equal(1);
              geofencing.watching[1].should.be.equal(2);
              geofencing.watching[2].should.be.equal(3);
              spy_sync.calledOnce.should.be.equal(true);

              storage2.do('all', {type: 'geofences'}, (err, rows) => {
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

            spy_store = sinon.spy(storage2.storage_fns, 'set');
            spy_del = sinon.spy(storage2.storage_fns, 'del');

            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
              return cb(null, {body: fences2});
            });
          })

          after(function() {
            push_stub.restore();
            spy_sync.restore();
            spy_store.restore();
            spy_del.restore();
          })

          it('call sync and stores the new zones', function(done) {
            storage2.do('all', {type: 'geofences'}, (err, rows) => {
              console.log("ROWS 2!!--------------------------------------------------------------", rows)
              rows.length.should.be.equal(3);
              geofencing.start({}, function() {
                spy_sync.calledOnce.should.be.equal(true);
                console.log("WATCHING OE!", geofencing.watching)
                geofencing.watching[0].should.be.equal(1);
                geofencing.watching[1].should.be.equal(2);
                geofencing.watching[2].should.be.equal(3);
                geofencing.watching[3].should.be.equal(4);
                geofencing.watching[4].should.be.equal(5);

                storage2.do('all', {type: 'geofences'}, (err, rows) => {
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
            //watching
            push_data.reason.should.exist;
            push_data.reason.should.be.equal('[1,2,3,4,5]')
            done();
          })
        });

        // describe('and theres less fences compared with the stored', function() {

        // });

        // describe('and theres no new fences comparing with the stored', function() {
        //   before(function() {
        //     spy_push = sinon.spy(push, 'response');
        //     spy_sync = sinon.spy(geofencing, 'sync');
        //     local_stub = sinon.stub(geofencing, 'get_geofences').callsFake(cb => {
        //       return cb(null, local_fences_2)
        //     });
        //   })

        //   after(function() {
        //     spy_sync.restore();
        //     spy_push.restore();
        //     local_stub.restore();
        //   })

        //   it('call sync', function(done) {
        //     geofencing.start({}, function() {
        //       spy_sync.calledOnce.should.be.equal(true);
        //       done();
        //     })
        //   })

        //   it('does not notify to control panel', function(done) {
        //     spy_push.notCalled.should.be.equal(true);
        //     done();
        //   })
        // })

      })

    })

  })

})
