var join     = require('path').join,
    should   = require('should'),
    sinon    = require('sinon'),
    helpers  = require('./../../../helpers'),
    api_path = join('plugins','control-panel','api'),
    location = helpers.load('triggers/location'),
    devices  = helpers.load(join(api_path, 'devices')),
    request  = helpers.load(join(api_path, 'request')),
    keys     = helpers.load(join(api_path, 'keys')),
    control_panel = helpers.load('plugins/control-panel');

var dummy = { 
    lat: -33.0,
    lng: 100.0,
    accuracy: 50,
    method: 'wifi' 
}

describe('location', () => {

  describe('send_location', () => {

    describe('when location is asked by control panel', () => { 
      var spy_post;
      before(() => {
        spy_post = sinon.stub(devices, 'post_location').callsFake((keys, cb) => { return cb(); });
      })
      after(() => {
        spy_post.restore();
      })

      it('should not be awared', (done) => {
        location.send_location('control-panel', dummy);
        spy_post.notCalled.should.be.equal(true);
        done();
      })
    })

    describe('on aware status', () => {
      var stub_aware,
          spy_status;

      var shared_keys_stub,
          stub_request;

      before(() => {
        shared_keys_stub = sinon.stub(keys, 'get').callsFake(() => {
          var keys = {
            api    : 'aaaaaaaaaaa',
            device : 'bbbbbb'
          };
          return keys;
        });
      })
      after(() => {
        shared_keys_stub.restore();
      })

      describe('when panel aware config is off', () => {

        var resp = { statusCode: 201 };

        before(() => {
          stub_request = sinon.stub(request, 'post').callsFake((path, data, opts, cb) => { 
            return cb(null, resp); 
          });
        })

        after(() => {
          stub_request.restore();   
        })

        describe('and local config is on', () => {
          before(() => {
            stub_aware = sinon.stub(control_panel, 'get_setting').callsFake((data, cb) => { return true; });
            stub_update = sinon.stub(control_panel, 'update_setting').callsFake((data, cb) =>{ return; });
          })
          after(() => {
            stub_aware.restore();
            stub_update.restore();
          })

          it('updates the local config', (done) => {
            location.send_location('mac-address', dummy);
            stub_update.calledOnce.should.be.equal(true);
            done();
          })
        })

        describe('and local config is off', () => {
          before(() => {
            stub_aware = sinon.stub(control_panel, 'get_setting').callsFake((data, cb) => { return false; });
            stub_update = sinon.stub(control_panel, 'update_setting').callsFake((data, cb) =>{ return; });
            spy_status = sinon.stub(devices.get, 'status').callsFake((cb) =>{ return location.post_it(dummy); });
          })
          after(() => {
            stub_aware.restore();
            stub_update.restore();
            spy_status.restore();
          })

          it('does not update the local config', (done) => {
            location.send_location('mac-address', dummy);
            stub_aware.calledTwice.should.be.equal(true);
            stub_update.notCalled.should.be.equal(true);
            spy_status.calledOnce.should.be.equal(true);
            done();
          })
        })
      })

      describe('when panel aware config is on', () => {

        var resp = {statusCode: 200}

        before(() => {
          stub_request = sinon.stub(request, 'post').callsFake((path, data, opts, cb) => { 
            return cb(null, resp); 
          });
        })

        after(() => {
          stub_request.restore();
        })

        describe('and local config is on', () => {
          before(() => {
            stub_aware = sinon.stub(control_panel, 'get_setting').callsFake((data, cb) => { return true; });
            stub_update = sinon.stub(control_panel, 'update_setting').callsFake((data, cb) =>{ return; });
          })
          after(() => {
            stub_aware.restore();
            stub_update.restore();
          })

          it('updates the local config', (done) => {
            location.send_location('mac-address', dummy);
            stub_update.notCalled.should.be.equal(true);
            done();
          })
        })

        describe('and local config is off', () => {
          before(() => {
            stub_aware = sinon.stub(control_panel, 'get_setting').callsFake((data, cb) => { return false; });
            stub_update = sinon.stub(control_panel, 'update_setting').callsFake((data, cb) =>{ return; });
            spy_status = sinon.stub(devices.get, 'status').callsFake((cb) =>{ return location.post_it(dummy); });
          })
          after(() => {
            stub_aware.restore();
            stub_update.restore();
            spy_status.restore();
          })

          it('does not update the local config', (done) => {
            location.send_location('mac-address', dummy);
            stub_aware.calledTwice.should.be.equal(true);
            stub_update.calledOnce.should.be.equal(true);
            spy_status.calledOnce.should.be.equal(true);
            done();
          })
        })
      })

      describe('when panel aware config response is >201', () => {
        var resp = {statusCode: 400}

        before(() => {
          stub_request = sinon.stub(request, 'post').callsFake((path, data, opts, cb) => { 
            return cb(null, resp); 
          });
        })

        after(() => {
          stub_request.restore();
        })

        describe('and local config is off', () => {
          before(() => {
            stub_update = sinon.stub(control_panel, 'update_setting').callsFake((data, cb) =>{ return; });
          })
          after(() => {
            stub_update.restore();
          })

          it('does not update the local config', (done) => {
            location.post_it( dummy);
            stub_update.notCalled.should.be.equal(true);
            done();
          })
        })

      })

    })

  })

});