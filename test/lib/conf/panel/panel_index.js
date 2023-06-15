var sinon   = require('sinon'),
    should  = require('should'),
    helpers = require('./../../../helpers'),
    shared  = require(helpers.lib_path('conf', 'shared')),
    panel   = require(helpers.lib_path('conf', 'panel')),
    secure  = require(helpers.lib_path('agent', 'plugins', 'control-panel', 'secure'));

describe('check_and_show()', function() {
  var spy_show = sinon.spy(panel, 'show'),
      spy_force = sinon.spy(panel, 'force_new_config'),
      spy_reset = sinon.spy(panel, 'reset_old_keys');

  describe('when configures new device', function() {
    var config_stub, device_stub;

    before(function() {
      spy_show = sinon.spy(panel, 'show');
      config_stub = sinon.stub(secure, 'open_config').callsFake(() => { return true; });
      device_stub = sinon.stub(shared.keys, 'verify_current').callsFake(cb => {
        return cb(new Error('API Key not found!'));
      });
    })

    after(function() {
      config_stub.restore();
      device_stub.restore();
      spy_show.restore();
      spy_reset.restore();
    })

    it('shows the configurator', function(done) {
      panel.check_and_show({});

      setTimeout(function() {
        should.not.exist(panel.device_key)
        spy_show.calledOnce.should.equal(true);
        spy_force.notCalled.should.equal(true);
        done();
      }, 1250)
    })

  });

  describe('when device its already configured', function() {
    describe('when keys are valid', function() {

      describe('when not force new config', function() {
        var config_stub, device_stub, shared_keys_stub;

        before(function() {
          config_stub = sinon.stub(secure, 'open_config').callsFake(() => { return true; });
          device_stub = sinon.stub(shared.keys, 'verify_current').callsFake(cb => { return cb(null); });
          shared_keys_stub = sinon.stub(shared.keys, 'get').callsFake(() => {
            var keys = {
              api    : 'aaaaaaaaaaa',
              device : 'bbbbbb'
            };
            return keys;
          });
        })

        after(function() {
          config_stub.restore();
          device_stub.restore();
          shared_keys_stub.restore();
          spy_show.restore();
        })

        it('shows the configurator and not force new config', function(done) {
          panel.check_and_show({});

          setTimeout(function() {
            panel.device_key.should.equal('bbbbbb')
            spy_show.calledOnce.should.equal(true);
            spy_force.notCalled.should.equal(true);
            done();
          }, 250)
        });
      });

      describe('when forces new config', function() {
        var config_stub, device_stub, shared_keys_stub;

        before(function() {
          spy_show = sinon.spy(panel, 'show');
          spy_force = sinon.spy(panel, 'force_new_config');
          config_stub = sinon.stub(secure, 'open_config').callsFake(() => { return true; });
          device_stub = sinon.stub(shared.keys, 'verify_current').callsFake(cb => { return cb(null); });
          shared_keys_stub = sinon.stub(shared.keys, 'get').callsFake(() => {
            var keys = {
              api    : 'aaaaaaaaaaa',
              device : 'bbbbbb'
            };
            return keys;
          });
        })

        after(function() {
          config_stub.restore();
          device_stub.restore();
          shared_keys_stub.restore();
          spy_show.restore();
          spy_force.restore();
          spy_reset.restore();
        })

        it('shows the configurator and force new config', function(done) {
          panel.check_and_show({'-f': true});

          setTimeout(function() {
            spy_show.calledOnce.should.equal(true);
            spy_force.calledOnce.should.equal(true);
            done();
          }, 250)
        });
      })
    });

    describe('when keys are invalid', function() {
      var config_stub, device_stub;

      before(function() {
        config_stub = sinon.stub(secure, 'open_config').callsFake(() => { return true; });
        device_stub = sinon.stub(shared.keys, 'verify_current').callsFake(cb => {
          var error = {
            message: 'Device not found in database. Please reconfigure.',
            code: 'INVALID_DEVICE_KEY'
          }
          return cb(error);
        });
      })
  
      after(function() {
        config_stub.restore();
        device_stub.restore();
        spy_show.restore();
        spy_force.restore();
        spy_reset.restore();
      });

      it('shows the configurator and force new config', function(done) {
        panel.check_and_show({});

        setTimeout(function() {
          should.not.exist(panel.device_key)
          spy_show.calledOnce.should.equal(true);
          spy_force.calledOnce.should.equal(true);
          done();
        }, 250)
      });
    })

  });

  describe('when renews the security keys', function() {
    var config_stub, device_stub, reset_stub;

    before(function() {
      spy_reset = sinon.spy(panel, 'reset_old_keys');
      reset_stub = sinon.stub(secure, 'reset_keys').callsFake(cb => { return cb(null); });
      config_stub = sinon.stub(secure, 'open_config').callsFake(() => { return true; });
      device_stub = sinon.stub(shared.keys, 'verify_current').callsFake(cb => { return cb(null); });
    })

    after(function() {
      config_stub.restore();
      device_stub.restore();
      reset_stub.restore();
      spy_show.restore();
      spy_force.restore();
      spy_reset.restore();
    })

    it('shows the configurator and resets private keys', function(done) {
      panel.check_and_show({'-r': true});

      setTimeout(function() {
        spy_reset.calledOnce.should.equal(true);
        spy_show.calledOnce.should.equal(true);
        spy_force.calledOnce.should.equal(true);
        done();
      }, 250)
    })
    
  })
})