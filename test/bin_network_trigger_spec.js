
// This test is only workable for ´nix´ os
if (process.platform == 'win32') return;

var join                  = require('path').join,
    default_prey_bin      = join('/', 'usr','lib','prey','current','bin','prey'),
    default_prey_bin_dir  = join('/','usr','lib','prey','current','bin'),
    default_prey_dir      = join('/','usr','lib','prey'),
    trigger_filename      = join(__dirname, '..', 'bin', 'mac', 'prey-trigger.py'),
    fs                    = require('fs'),
    fsx                   = require('node-fs'),
    spawn                 = require('child_process').spawn,
    utils                 = require(join(__dirname, 'lib','test_utils'));
    is_root               = process.getuid() === 0;

if (is_root) { // this test will run only if we invoke `sudo bin/prey test`

describe('when called with no arguments #wip', function(){

  is_faked_prey_dir_created = false;

  // Temporarily move the default prey bin, or create a provisory one
  // we'll restore it later
  before(function(done){
    fs.exists(default_prey_bin, function(exists){
      if (exists) {
        fs.rename(default_prey_bin, default_prey_bin + '.tmp', function(err){
          done();
        });
      } else {
        fsx.mkdir(default_prey_bin_dir, 0755, true, function(){
          is_faked_prey_dir_created = true;
          done();
        });
      }
    });
  });

  it('sets prey_bin_path to `/usr/lib/prey/current`', function(done){
    // Spawn the process
    var py_trigger = spawn(trigger_filename, []);
    // Create the `killer file` (we couldn't do it before since we did not know the pid)
    fs.writeFileSync(default_prey_bin, '#!/bin/bash\nkill -s SIGUSR2 ' + py_trigger.pid, {mode : 0755});

    py_trigger.on('close', function(code, signal){
      signal.should.be.equal('SIGUSR2');
      done();
    });
  });

  // make sure the default bin is put back in place
  after(function(done){
    if (is_faked_prey_dir_created) {
      utils.rmdir_sync_force(default_prey_dir);
      done();
    } else {
      fs.unlink(default_prey_bin, function(){
        fs.rename(default_prey_bin + '.tmp', default_prey_bin, done);
      });
    }
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
