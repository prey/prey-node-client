var should        = require('should'),
    path          = require('path'),
    fs            = require('fs'),
    os            = require('os'),
    exec          = require('child_process').exec,
    is_windows    = process.platform == 'win32';

var exec_env      = process.env, // so we can override it later
    node_versions = {},
    bin_path      = path.join(__dirname, '..', 'bin'),
    bin_prey      = path.join(bin_path, 'prey'),
    node_bin      = path.join(bin_path, 'node'),
    fake_node     = path.join(os.tmpDir(), 'node'),
    fake_log_file = path.join(os.tmpDir(), 'fake_test_log_file.log'),
    local_present = fs.existsSync(node_bin);

if (is_windows) {
  node_bin  += '.exe';
  fake_node += '.cmd';
  bin_prey  += '.cmd';
}

function run_bin_prey(args, cb){
  exec(bin_prey + args, {env: exec_env}, cb);
}

function system_node_exists(cb){
  exec('node -v', {env: exec_env}, function(err, out){
    var not_found = err; // && out.toString().match('not found');
    cb(!not_found);
  })
}

function mask_local_node(done){
  fs.renameSync(node_bin, node_bin + '.tmp');
  var fake_node_content = is_windows ? 'echo %*' : 'echo $@';

  fs.writeFileSync(fake_node, fake_node_content, {mode: 0755});
  return done();
}

function unmask_local_node(done){
  fs.rename(node_bin + '.tmp', node_bin, function(err){
    done();
  });
}

/**
 *  START TESTS
 *
 */
describe('bin/prey', function(){

  before(function(done){
    var callbacks = 2;
    exec('node -v', function(err, out){
      if (!err) node_versions.system = out.toString().trim();
      --callbacks || done();
    })
    exec(node_bin + ' -v', function(err, out){
      if (!err) node_versions.local = out.toString().trim();
      --callbacks || done();
    })
  });

  if (local_present) { // no point in checking if it's not there

    describe('when local node binary is present', function(){
      before(function(done){
         fs.exists(node_bin, function(exists){
          exists.should.be.true;
          done();
        });
      });

      it('uses local node binary', function(done){
        run_bin_prey(' -l ' + fake_log_file +' -N', function(err){
          should.not.exist(err);
          var read_version = fs.readFileSync(fake_log_file, 'utf8');
          read_version.should.include(node_versions.local);
          done();
        })
      });

      after(function(done){
        fs.unlink(fake_log_file, done);
      });
    });

  }

  // To test params, we create a fake node bin so we can capture
  // the arguments with which it is called.
  // We also set the PATH variable to that dir, to make sure it's called

  describe('params', function(){

    before(function(done){
      mask_local_node(done);



    });

    describe('when called with no params', function(){

      it('calls lib/agent/cli.js', function(done){
        run_bin_prey('', function(err, out){

          console.log(err)

          out.should.include(path.join('lib', 'agent', 'cli.js'));
          done();
        });
      });

    });

    describe('when called with `config` param', function(){

      it('calls lib/conf/cli.js', function(done){
        run_bin_prey(' config', function(err, out){
          out.should.include(path.join('lib', 'conf', 'cli.js'));
          done();
        });
      });

      it('passes any other arguments too (eg. `config activate`)', function(done){
        run_bin_prey(' config activate', function(err, out){
          var out_command =
            is_windows  ? 'lib\\conf\\cli.js" config activate'
                        : 'lib/conf/cli.js config activate';
          out.should.include(out_command);
          done();
        });
      });
    });

    describe('when called with `test` argument', function(){
      it('calls mocha', function(done){
        run_bin_prey(' test', function(err, out){
          out.should.include(path.join('node_modules', 'mocha', 'bin', 'mocha'));
          done();
        });
      });

      it('passes any other arguments too (eg. `--reporter nyan`)', function(done){
        run_bin_prey(' test --reporter nyan', function(err, out){
          var out_command =
            is_windows  ? 'node_modules\\mocha\\bin\\mocha" test --reporter nyan'
                        : 'node_modules/mocha/bin/mocha test --reporter nyan';
          out.should.include(out_command);
          done();
        });
      });
    });

    describe('when called with unknown argument', function(){
      it('calls lib/agent/cli.js', function(done){
        run_bin_prey(' hellomyfriend', function(err, out, err){
          var out_command =
            is_windows  ? 'lib\\agent\\cli.js" hellomyfriend'
                        : 'lib/agent/cli.js hellomyfriend';

          out.should.include(out_command);
          done();
        });
      });
    });

    after(function(done){
      exec_env = process.env;
      fs.unlink(fake_node, function(){
        unmask_local_node(done)
      });
    });

  });
});
