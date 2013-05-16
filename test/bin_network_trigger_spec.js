
// This test is only workable for ´nix´ os
if (process.platform == 'win32') return;

var default_prey_bin  = '/usr/lib/prey/current/bin/prey',
    default_prey_dir  = '/usr/lib/prey/current/bin/'
    fs                = require('fs'),
    is_root           = process.getuid() === 0;

if (is_root) { // this test will run only if we invoke `sudo bin/prey test`

describe('when called with no arguments #wip', function(){
    
  // Temporarily move the default prey bin, we'll restore it later
  before(function(done){
    fs.exists(default_prey_bin, function(exists){
      console.log(exists);
       // PLACEHOLDER
      done();
      // PLACEHOLDER-END   
    });
  });

  it('sets prey_bin_path to `/usr/lib/prey/current`', function(done){
    // PLACEHOLDER
    done();
    // PLACEHOLDER-END
  });

  // make sure the default bin is put back in place
  after(function(done){
    // PLACEHOLDER
    done();
    // PLACEHOLDER-END
  });
});
} // end `is_root` condition

describe('when called with argument', function(){
  describe('and that path does not exist', function(){
    it('exits with error code');
  });
  describe('and that path exists', function(){
    it('sets prey_bin_path as that one');
  });
});

describe('when a network change is detected', function(){
  it('checks if there is internet connection')
  describe('and there is no internet connection', function(){
    it('does not call the prey script');
    it('keeps running');
  });
  describe('and there is internet connection', function(){
    describe('and prey_bin hasn\'t been called', function(){
      it('calls the script');
      it('keeps running');
    });
    describe('and prey_bin has been called', function(){
      describe('and last call time was less than two minutes ago', function(){
        it('does not call the script');
        it('keeps running');
      });
      describe('and last call time was more than two minutes ago', function(){
        it('calls the script');
        it('keeps running');
      });
    });
  });
});
