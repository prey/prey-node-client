
// This test is only workable for ´nix´ os
if (process.platform == 'win32') return;

var join                  = require('path').join,
    default_prey_bin      = join('/', 'usr','lib','prey','current','bin','prey'),
    default_prey_bin_dir  = join('/','usr','lib','prey','current','bin'),
    default_prey_dir      = join('/','usr','lib','prey'),
    fake_prey_filename    = join('/', 'tmp', 'b4f9259646c478cccebcf52eccf30a3d_prey'),
    os_name               = process.platform === 'darwin' ? 'mac' : 'linux',
    trigger_filename      = join(__dirname, '..', 'bin', os_name, 'prey-trigger.py'),
    fs                    = require('fs'),
    fsx                   = require('node-fs'),
    spawn                 = require('child_process').spawn,
    utils                 = require(join(__dirname, 'lib','test_utils'));
    is_root               = process.getuid() === 0;

describe('bin_network_trigger_spec', function(){

if (is_root) { // this test will run only if we invoke `sudo bin/prey test`

describe('when called with no arguments', function(){

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

describe('when a network change is detected', function(){

  is_faked_prey_dir_created = false;

  it('checks if there is internet connection', function(done){
    this.timeout(10000);
    var py_trigger = spawn(trigger_filename, ['-b', fake_prey_filename, '-s']);

    fs.writeFileSync(fake_prey_filename, '#!/bin/bash\nkill -s SIGUSR2 ' + py_trigger.pid, {mode : 0755});
    utils.make_network_down();
    var t = setTimeout(function() { utils.make_network_up(); }, 1000);

    py_trigger.on('close', function(code, signal){
      signal.should.be.equal('SIGUSR2');
      fs.unlink(fake_prey_filename, done);
    });
  });

  describe('and there is no internet connection', function(){

    it('does not call the prey script and keeps running', function(done){
      // We will run the script for ten seconds.
      // If it closes, it means that the prey script was called, so the test fails...
      // Now, if it doesn't, we assume that the script will never be called, so it's a OK
      this.timeout(12000);
      var flag_end_test_called = false; // prevents the function from being called twice

      var py_trigger = spawn(trigger_filename, ['-b', fake_prey_filename, '-s']);

      fs.writeFileSync(fake_prey_filename, '#!/bin/bash\nkill -s SIGUSR2 ' + py_trigger.pid, {mode : 0755});
      utils.make_network_down();
      var t = setTimeout(function() {
        // Timeout of ten seconds passed! Test OK
        end_test();
      }, 10000);

      // Leave this babe here, in case someday you want to "test the test"
      // This one will mimic the effect of the script being called
      // var x = setTimeout(function() { py_trigger.kill('SIGUSR1');}, 3000)

      py_trigger.on('close', function(code, signal){
        // The test has failed, the script has been called :(
        end_test(true); // we put the `fail` flag on
      });

      function end_test (fail) {
        if (!flag_end_test_called) {
          flag_end_test_called = true;
          fs.unlinkSync(fake_prey_filename);
          clearTimeout(t);
          utils.make_network_up();
          if (fail)  {
            throw('Prey script shouldn\'t be called!');
          } else {
            done();
          }
        }
      }
    });
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
} // end `is_root` condition

// Tests which don't require root condition
describe('when called with argument', function(){

  describe('and that path does not exist', function(){

    it('exits with error code', function(done){
      var py_trigger = spawn(trigger_filename, ['-b', fake_prey_filename]);

      py_trigger.on('close', function(code){
        code.should.be.equal(1);
        done();
      });
    });
  });

  describe('and that path exists', function(){

    it('sets prey_bin_path as that one', function(done){
      // Create prey process and `killer file`
      var py_trigger = spawn(trigger_filename, ['-b', fake_prey_filename]);
      fs.writeFileSync(fake_prey_filename, '#!/bin/bash\nkill -s SIGUSR2 ' + py_trigger.pid, {mode : 0755});

      py_trigger.on('close', function(code, signal){
        signal.should.be.equal('SIGUSR2');
        done();
      });
    });

    // Delete this fake prey file
    after(function(done){
      fs.unlink(fake_prey_filename, done);
    });
  });
});

}); // Main test wrapper
