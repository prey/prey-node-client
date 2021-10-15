var helpers     = require('./../../../helpers'),
    should      = require('should'),
    sinon       = require('sinon'),
    join        = require('path').join,
    lib_path    = helpers.lib_path(),
    geof_path   = join(lib_path, 'agent', 'actions', 'geofencing'),
    api_path    = join(lib_path, 'agent', 'plugins', 'control-panel', 'api');
    geofencing  = require(geof_path),
    request     = require(join(api_path, 'request')),
    push        = require(join(api_path, 'push')),
    keys        = require(join(api_path, 'keys')),
    //geo_storage = require(join(geof_path, 'storage')),
    storage = require(join(lib_path, 'agent', 'utils', 'commands_storage'));
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
          spy_sync.notCalled.should.be.equal(true);
          done();
        })
      })
    })

    describe('when the fences obtained are valid', function() {

      describe('and theres zero fences', function() {

        before(function() {
          spy_sync = sinon.spy(geofencing, 'sync');
          //spy_clear = sinon.spy(storage, 'do');
          clear_stub = sinon.stub(storage, 'do').callsFake((type, cb) => {
            //return cb();
          })
          get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
            return cb(null, {body: []});
          })
        })

        after(function() {
          get_stub.restore();
          //spy_clear.restore();
          clear_stub.restore();
          spy_sync.restore();
        })

        it('call sync and deletes local fences', function(done) {
          geofencing.start({}, function() {
            spy_sync.calledOnce.should.be.equal(true);
            //spy_clear.calledOnce.should.be.equal(true);
            done();
          })
        })

      })

      describe('and theres one or more fences', function() {
        var push_data;
        before(function() {
          get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
            return cb(null, {body: fences});
          });
          store_stub = sinon.stub(storage, 'do').callsFake((key, opts, cb) => {
            //return cb();
          })
        })

        after(function() {
          store_stub.restore();
          get_stub.restore();
        })

      describe('and theres new fences compared with the stored', function() {
          before(function() {
            push_stub = sinon.stub(push, 'response').callsFake((data, opts, cb) => {
              push_data = data
              return true;
            });

            spy_sync = sinon.spy(geofencing, 'sync');
            local_stub = sinon.stub(storage, 'do').withArgs('all', {type: 'geofences'}).callsFake(cb => {
              return cb(null, local_fences)
            });
          })

          after(function() {
            push_stub.restore();
            spy_sync.restore();
            local_stub.restore();
          })

          it('call sync', function(done) {
            geofencing.start({}, function() {
              spy_sync.calledOnce.should.be.equal(true);
              done();
            })
          })

          it('does notify to control panel', function(done) {
            push_data.reason.should.exist;
            push_data.reason.should.be.equal('[2,3]');
            done();
          })
        });

        describe('and theres no new fences comparing with the stored', function() {
          before(function() {
            spy_push = sinon.spy(push, 'response');
            spy_sync = sinon.spy(geofencing, 'sync');
            local_stub = sinon.stub(geo_storage, 'get_geofences').callsFake(cb => {
              return cb(null, local_fences_2)
            });
          })

          after(function() {
            spy_sync.restore();
            spy_push.restore();
            local_stub.restore();
          })

          it('call sync', function(done) {
            geofencing.start({}, function() {
              spy_sync.calledOnce.should.be.equal(true);
              done();
            })
          })

          it('does not notify to control panel', function(done) {
            spy_push.notCalled.should.be.equal(true);
            done();
          })
        })

      })

    })

  })

})
