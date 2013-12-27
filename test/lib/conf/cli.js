var join   = require('path').join,
    spawn  = require('child_process').spawn,
    should = require('should');

var prey_bin = join(__dirname, '..', '..', '..', 'bin', 'prey');

describe('config cli', function() {
 
  var run_cli = function(args, cb) {
    var out, err, child = spawn(prey_bin, args);
    child.stdout.on('data', function(data) { out += data });
    child.stderr.on('data', function(data) { out += data });
    child.on('exit', function(code) { cb(code, out, err) });
  };
 
  describe('when no arguments are passed', function(){
    
    it('shows help and exits')
    
    it('returns status code 1')
    
  })
  
  describe('activate', function(){
    
  })
  
  describe('upgrade', function(){
    
  })
  
  describe('settings', function(){
    
  })
  
  describe('account', function() {
    

    describe('verify', function() {

      describe('with invalid api key and email', function() {

        it('returns error code 1', function(done){ 

          run_cli(['account', 'verify', '-a', 'foobar', '-d', 'barbaz'], function(code, out) {
            code.should.equal(1);
            done();
          })

        })

      });

    })

  })

  describe('hooks', function(){
    
    describe('post_install', function(){
  
    })
    
    describe('pre_uninstall', function(){
      
    })
    
  })

  describe('check', function(){
    
  })
  
  describe('run', function(){
    
  })

  describe('gui', function(){
    
  })
  
})
