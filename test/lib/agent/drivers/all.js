var fs      = require('fs'),
    should  = require('should'),
    Emitter = require('events').EventEmitter,
    valid_opts = require('./fixtures/valid_opts'),
    default_config_path = __dirname + '/../../../prey.conf.default';

describe('all drivers', function(){

  var drivers_path = __dirname + '/../../../lib/agent/drivers/';
  var drivers = fs.readdirSync(drivers_path);

  // console driver works differently, so lets remove it from the list
  drivers.splice(drivers.indexOf('console'), 1);

  describe('exports', function(){

    it('only load/unload functions', function(){

      drivers.forEach(function(driver_name){

        var mod = require(drivers_path + driver_name);
        Object.keys(mod).length.should.equal(2);
        Object.keys(mod).should == ['load', 'unload'];

      })

    })

  })

  describe('on load', function(){

    describe('when no options are passed', function(){

      it('does not throw', function(done){

        drivers.forEach(function(driver_name){

          var mod = require(drivers_path + driver_name);

          (function(){
            mod.load(null, function(){
            })
          }).should.not.throw();

        })

        done();

      })

    })

/*
    describe('when default config options are passed', function(){

      var config  = require('getset').readSync(default_config_path).values;

      it('callsback an error', function(done){

        drivers.forEach(function(driver_name){

          var mod = require(drivers_path + driver_name);

          mod.load(config[driver_name], function(err, emitter){
            // console.log(err);
            (err instanceof Error).should.equal(true);
            should.equal(emitter, null);
          })

        })

        done();

      });

    })


   describe('when valid options are passed', function(){

      it('callback an emitter', function(done){

        drivers.forEach(function(driver_name){

          var mod = require(drivers_path + driver_name);

          mod.load(valid_opts[driver_name], function(err, emitter){
            should.not.exist(err);
            (emitter instanceof Emitter).should.equal(true);
          })

        })

        done();

      });

    })

  }) // on load

  describe('on unload', function(){

    describe('if not loaded', function(){

      it('does not throw', function(done){

        drivers.forEach(function(driver_name){

          var mod = require(drivers_path + driver_name);

          (function(){
            mod.unload()
          }).should.not.throw();

        })

        done();

      })

      it('returns null', function(done){

        drivers.forEach(function(driver_name){

          var mod = require(drivers_path + driver_name);
          var resp = mod.unload()
          should.equal(resp, null);

        })

        done();

      })

    })

    describe('if loaded', function(){

      it('emits and unload event', function(done){

        var count = 0;

        drivers.forEach(function(driver_name){

          var mod = require(drivers_path + driver_name);
          mod.load(valid_opts[driver_name], function(err, emitter){

            emitter.once('unload', function(){
              count++;
            })

            mod.unload();

          })

        })

        count.should == drivers.length;
        done();

      })

    })

*/

  })

})
