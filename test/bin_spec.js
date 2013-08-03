var should        = require('should'),
    path          = require('path'),
    fs            = require('fs'),
    os            = require('os'),
    exec          = require('child_process').exec,
    spawn         = require('child_process').spawn,
    is_windows    = process.platform == 'win32';

var exec_env      = process.env, // so we can override it later
    node_versions = {},
    bin_path      = path.join(__dirname, '..', 'bin'),
    bin_prey      = path.join(bin_path, 'prey'),
    node_bin      = path.join(bin_path, 'node'),
    fake_log_file = path.join(os.tmpDir(), 'fake_test_log_file.log'),
    local_present = fs.existsSync(node_bin);

if (is_windows) {
  node_bin  += '.exe';
  bin_prey  += '.cmd';
}

function run_bin_prey(args, cb){
  var child = spawn(bin_prey, args, { env: exec_env });

  var out = '', err = '';

  child.stdout.on('data', function(data){
    out += data;
  })

  child.stderr.on('data', function(data){
    err += data;
  })

  child.on('exit', function(code){
    cb(code, out, err)
  })

  setTimeout(function(){
    child.kill()
  }, 500);
}

/*

function mask_bin_prey(){
  var bin_prey_content = fs.readFileSync(bin_prey,'utf8');
  fs.renameSync(bin_prey, bin_prey + '.tmp');
  var fake_prey_content = bin_prey_content.replace('if (scr',
    'var require=function(str){console.log(str);console.log(process.argv);return 0;}\nif (scr');
  fs.writeFileSync(bin_prey, fake_prey_content, {mode: 0755});
}

function unmask_bin_prey(){
  fs.renameSync(bin_prey + '.tmp', bin_prey);
}

*/

/**
 *  START TESTS
 *
 */
describe('bin/prey', function(){

  before(function(done){
    exec(node_bin + ' -v', function(err, out){
      if (!err) node_versions.local = out.toString().trim();
      done();
    })
  });

  if (local_present) { // no point in checking if it's not there

    describe('when local node binary is present', function(){

      // check, just in case
      before(function(done){
         fs.exists(node_bin, function(exists){
          exists.should.be.true;
          done();
        });
      });

      after(function(done){
        fs.unlink(fake_log_file, done);
      });

      it('uses local node binary', function(done){
        run_bin_prey(['-l', fake_log_file, '-N'], function(code){
          code.should.equal(0);
          var read_version = fs.readFileSync(fake_log_file, 'utf8');
          read_version.should.include(node_versions.local);
          done();
        })
      });
    });

  }

  // To test params, we create a fake node bin so we can capture
  // the arguments with which it is called.
  // We also set the PATH variable to that dir, to make sure it's called

  describe('params', function(){

    describe('when called -h param', function(){

      it('calls lib/agent/cli.js', function(done){
        run_bin_prey(['-h'], function(code, out, err){
          // out.should.include('spreads its wings');
          out.should.include('--logfile');
          done();
        });
      });

    });

    describe('when called with `config` param', function(){

      it('calls lib/conf/cli.js', function(done){
        run_bin_prey(['config'], function(code, out){
          out.should.include('prey config');
          out.should.include('activate');
          out.should.include('deactivate');
          done();
        });
      });

      it('passes any other arguments too (eg. `config activate`)', function(done){
        run_bin_prey(['config', 'account'], function(code, out){
          out.should.include('verify');
          out.should.include('signup');
          done();
        });
      });
    });

/*

    describe('when called with `test` argument', function(){
      it('calls mocha', function(done){
        run_bin_prey(' test', function(err, out){
          var out_command =
            is_windows ? 'node_modules\\.bin\\_mocha'
                       : 'node_modules/.bin/_mocha'
          out.should.include(out_command);
          done();
        });
      });

      it('passes any other arguments too (eg. `--reporter nyan`)', function(done){
        run_bin_prey(' test --reporter nyan', function(err, out){
          var out_command =
            is_windows  ? 'node_modules\\.bin\\_mocha'
                        : 'node_modules/.bin/_mocha';
          out.should.include(out_command);
          out.should.include('--reporter');
          out.should.include('nyan');
          done();
        });
      });
    });

*/

    describe('when called with unknown argument', function(){
      it('returns unknown option', function(done){
        run_bin_prey(['--hellomyfriend'], function(err, out, stderr){
          stderr.should.include('unknown option');
          done();
        });
      });
    });

  });

});
