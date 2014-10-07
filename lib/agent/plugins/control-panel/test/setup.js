var fs       = require('fs'),
    join     = require('path').join,
    should   = require('should'),
    sinon    = require('sinon'),
    needle   = require('needle'),
    getset   = require('getset');

var common    = require('../../../common'),
    providers = require('../../../providers'),
    setup     = require('../setup'),
    api       = require('../api');

var default_host = 'somewhere.com',
    default_protocol = 'https';

describe('setup()', function() {

  // we roll our own fake config so we can control all its values
  var config = getset.load('/tmp/foo');

  config.global = {
    get: function(key) { return config.get('global_' + key) },
    set: function(key, val) { return config.set('global_' + key, val) }
  }

  // insert default values to config
  config.set('host', 'destination.com');
  config.set('protocol', 'https');

  // object that is passed to plugins
  var common_obj = {
    hooks  : common.hooks,
    logger : common.logger,
    config : config,
    providers: {
      get: function(key, cb) { cb(new Error('Data requested: ' + key)) }
    },
    system: {
      get_os_info: function(cb) {
        cb(null, { name: 'Windows', version: '6.2' });
      },
      get_os_name: function(cb) {
        cb(null, 'Windows');
      },
      get_os_version: function(cb) {
        cb(null, '6.2')
      },
      get_device_name: function() {
        return 'Lappy';
      }
    }
  }

  var call = function(cb) {
    setup.start(common_obj, cb);
  }

  before(function() {
    // ensure no keys are set in api
    api.keys.unset('api');
    api.keys.unset('device');
    common.logger.pause()
  })

  after(function() {
    common.logger.resume()
  })

  describe('with empty keys', function() {

    before(function() {
      config.set('api_key', '');
      config.set('device_key', '');
    })

    after(function() {
      // don't really need to reset keys
    })

    describe('and no config.global is found', function() {

      var saved;

      before(function() {
        saved = common_obj.config.global;
        common_obj.config.global = null;
      })

      after(function() {
        common_obj.config.global = saved;
      })

      it('it callbacks an error', function(done) {
        call(function(err) {
          err.should.be.a.Error;
          err.message.should.eql('No global keys found.');
          done();
        })
      })

    })

    describe('and config.global exists', function() {

      before(function() {
        should.exist(common_obj.config.global);
      })

      describe('and no keys either', function() {

        before(function() {
          config.set('global_api_key', '');
          config.set('global_device_key', '');

          config.get('global_api_key').should.eql('');
        })

        it('it callbacks an error', function(done) {
          call(function(err) {
            err.should.be.a.Error;
            err.message.should.containEql('No API key set!');
            done();
          })
        })

      })

      describe('and we DO find something in there', function() {

        var stop;

        before(function() {
          config.set('global_api_key', 'globalmegakey');
          config.set('global_device_key', '97979797');
          config.get('global_api_key').should.eql('globalmegakey');

          // stop the execution at the next stage (api.keys.set)
          // as we're only interested in this part right now
          stop = sinon.stub(api.keys, 'set', function(keys, cb) {
            cb(new Error('Stopping here.'))
          })
        })

        after(function() {
          stop.restore()
        })

        // this is VERY big, i know.
        it('moves them to local config scope, and saves', function(done) {
          var set   = sinon.spy(config, 'set'),
              save  = sinon.spy(config, 'save');

          call(function(err) {
            should.exist(err);
            err.message.should.eql('Stopping here.'); // just making sure

            set.callCount.should.eql(4); // two local, two global
            set.restore();

            save.called.should.be.true;
            save.restore();

            // let's see if it was actually saved
            var str = fs.readFileSync(config.path).toString();

            str.should.match(/\napi_key = globalmegakey/);
            str.should.match(/global_api_key = \n/); // global should have been emptied

            done();
          })
        })

      })

    })

  })

  describe('with Device key but no API key', function() {

    before(function() {
      config.set('api_key', '');
      config.set('device_key', '');
    })

    after(function() {
      // don't really need to reset keys
    })

    // already tested no callbacks, so we'll just skip that from now on.

    it('it callbacks an error', function(done) {
      call(function(err) {
        err.should.be.a.Error;
        err.message.should.containEql('No API key set');
        done();
      })
    })

  })

  describe('with API but no Device key', function() {

    // we already stubbed get_os_info

    before(function() {
      config.set('api_key', 'foobar123456');
      config.set('device_key', '');
    })

    it('tries to register device', function(done) {

      // when trying to register device, we call providers.get('specs') to get the device's data
      // so this is a good way of determining whether the flow reached this point.

      call(function(err) {
        err.should.be.a.Error;
        err.message.should.eql('Data requested: specs');
        done();
      })

    })

    describe('if request fails', function() {

      var prev,
          api_link_stub;

      before(function() {
        api_link_stub = sinon.stub(api.devices, 'link', function(opts, cb) {
          cb(new Error('Request failed.'))
        })

        var prev = common_obj.providers.get;
        common_obj.providers.get = function(key, cb) {
          return cb(null, { device_type: 'Laptop' })
        }
      })

      after(function() {
        api_link_stub.restore();
        common_obj.providers.get = prev;
      })

      it('callbacks an error', function(done) {
        call(function(err) {
          err.should.be.a.Error;
          err.message.should.eql('Request failed.');
          done();
        })
      })

    })

  })


  describe('with both keys', function() {

    describe('and API key is invalid', function() {

      it('pending')

    })

    describe('and Device key is invalid', function() {

      it('pending')
      
    })

    describe('and both keys are valid', function() {

      before(function() {
        config.set('api_key', 'valid_api_key');
        config.set('device_key', 'valid_device_key');
      })

      it('doesnt attempt to link device', function(done) {

        // when trying to register device, we call providers.get('specs') to get the device's data
        // so this is a good way of determining whether the flow reached this point.
        var spy = sinon.spy(providers, 'get');

        call(function(err) {
          spy.called.should.be.false;
          done()
        })

      })

      it('callback with no errors', function(done) {

        call(function(err) {
          should.not.exist(err);
          done()
        })

      }) 
      
    })
    
  })

})
