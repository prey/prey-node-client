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
    fake_log_file = path.join(os.tmpDir(), 'fake_test_log_file.log'),
    local_present = fs.existsSync(node_bin);

if (is_windows) {
  node_bin  += '.exe';
  bin_prey  += '.cmd';
}

function run_bin_prey(args, cb){
  exec(bin_prey + args, {env: exec_env}, cb);
}

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

    before(function(){
      mask_bin_prey();
    });

    describe('when called with no params', function(){

      it('calls lib/agent/cli.js', function(done){
        run_bin_prey('', function(err, out){
          var out_command =
            is_windows? 'lib\\agent\\cli'
              : '../lib/agent/cli\n';
          out.should.include(out_command);
          done();
        });
      });

    });

    describe('when called with `config` param', function(){

      it('calls lib/conf/cli.js', function(done){
        run_bin_prey(' config', function(err, out){
          var out_command =
            is_windows? 'lib\\conf\\cli'
              : '../lib/conf/cli\n'
          out.should.include(out_command);
          done();
        });
      });

      it('passes any other arguments too (eg. `config activate`)', function(done){
        run_bin_prey(' config activate', function(err, out){
          var out_command =
            is_windows  ? 'lib\\conf\\cli'
                        : '../lib/conf/cli\n';
          out.should.include(out_command);
          out.should.include('config');
          out.should.include('activate');
          done();
        });
      });
    });

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

    describe('when called with unknown argument', function(){
      it('calls lib/agent/cli.js', function(done){
        run_bin_prey(' hellomyfriend', function(err, out, err){
          var out_command =
            is_windows  ? 'lib\\agent\\cli'
                        : '../lib/agent/cli\n';
          out.should.include(out_command);
          out.should.include('hellomyfriend');
          done();
        });
      });
    });

    after(function(done){
      exec_env = process.env;
      fs.unlink(bin_prey, function(){
        unmask_bin_prey()
        done();
      });
    });

  });
});
