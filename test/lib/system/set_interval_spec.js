
/*

var sinon   = require('sinon'),
    should  = require('should'),
    join    = require('path').join,
    os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

describe('set_interval #sinon', function(){

  var get,
      set,
      sys_path = join(__dirname, '..', '..', 'lib', 'system'),
      delay    = require(join(sys_path, os_name, 'delay')),
      system   = require(sys_path);

  describe('when no delay is set', function(){

    before(function(){
      get = sinon.stub(delay, 'get', function(cb){ cb() });
      set = sinon.stub(delay, 'set', function(delay, cb){ cb() });
    });

    after(function(){
      get.restore();
      set.restore();
    });

    it('does not raise error', function(done){
      system.set_interval(60, function(err){
        should.not.exist(err);
        done();
      });
    });

    it('calls delay.set with argument', function(done){

      system.set_interval(60, function(err){
        set.withArgs(60).called.should.be.true;
        done();
      });

    });

  });

});

*/
