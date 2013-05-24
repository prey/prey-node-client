
// This test is only workable for ´nix´ os
if (process.platform == 'win32') return;

var join                  = require('path').join,
    default_prey_bin      = join('/', 'usr','lib','prey','current','bin','prey'),
    default_prey_bin_dir  = join('/','usr','lib','prey','current','bin'),
    default_prey_dir      = join('/','usr','lib','prey'),
    fake_prey_filename    = join('/', 'tmp', 'b4f9259646c478cccebcf52eccf30a3d_prey'),
    ni                    = require('os').networkInterfaces(),
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

  var active_network_interface_name;

  before(function(done){
    var network = require(join(__dirname, '..', 'lib', 'agent', 'providers', 'network', 'index'));
    network.get_active_network_interface(function(err, nic){
      active_network_interface_name = nic.name;
      done();
    });
  });

  describe('checks if there is internet connection', function(){
    describe('and the network is down', function(){

      before(function(done){
        utils.make_network_down(active_network_interface_name);
        done();
      });

      it('does not call the prey script and keeps running', function(done){
        this.timeout(12000);

        var py_trigger = spawn(trigger_filename, ['-b', fake_prey_filename, '-s']);
        fs.writeFileSync(fake_prey_filename, '#!/bin/bash\nkill -s SIGUSR2 ' + py_trigger.pid, {mode : 0755});

        var t = setTimeout(function(){ py_trigger.kill('SIGUSR1');}, 10000);

        py_trigger.on('close', function(code, signal){
          clearTimeout(t);
          signal.should.be.equal('SIGUSR1');
          done();
        });
      });

      after(function(done){
        utils.make_network_up(active_network_interface_name);
        fs.unlink(fake_prey_filename, done);
      });
    });

    describe('and the network is up', function(){

      before(function(done){
        utils.make_network_down(active_network_interface_name);
        done();
      });

      it('calls the prey script', function(done){
        this.timeout(6000);

        utils.make_network_up(active_network_interface_name);
        var py_trigger = spawn(trigger_filename, ['-b', fake_prey_filename, '-s']);
        fs.writeFileSync(fake_prey_filename, '#!/bin/bash\nkill -s SIGUSR2 ' + py_trigger.pid, {mode : 0755});

        py_trigger.on('close', function(code, signal){
          signal.should.be.equal('SIGUSR2');
          done();
        });
      });

      after(function(done){
        fs.unlink(fake_prey_filename, done);
      });
    });
  });
});

} // end `is_root` condition

// Tests which don't require root condition
describe('when called with `-b` argument', function(){

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

describe('when called with `-s` argument', function(){

  it('skips the calling of the script the first time is ran', function(done){
    this.timeout(6000);
    var py_trigger = spawn(trigger_filename, ['-b', fake_prey_filename, '-s']);
    fs.writeFileSync(fake_prey_filename, '#!/bin/bash\nkill -s SIGUSR2 ' + py_trigger.pid, {mode : 0755});

    var t = setTimeout(function(){ py_trigger.kill('SIGUSR1');}, 5000);

    py_trigger.on('close', function(code, signal){
      signal.should.be.equal('SIGUSR1');
      done();
    });
  });

  // Delete this fake prey file
  after(function(done){
    fs.unlink(fake_prey_filename, done);
  });
});

}); // Main test wrapper
