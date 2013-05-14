var sinon   = require('sinon'),
    should  = require('should'),
    path    = require('path'),
    fs      = require('fs'),
    os      = require('os'),
    exec    = require('child_process').exec;

var exec_env = process.env, // so we can override it later
    node_versions = {},
    bin_path = path.join(__dirname, '..', 'bin'),
    bin_prey = path.join(bin_path, 'prey'),
    node_bin = path.join(bin_path, 'node'),
    fake_node = path.join(os.tmpdir(), 'node'),
    local_present = fs.existsSync(node_bin);

if (process.platform == 'win32')
  fake_node += '.exe';

function run_bin_prey(args, cb){
  exec(bin_prey + args, {env: exec_env}, cb);
}

function system_node_exists(cb){
  exec('node -v', {env: exec_env}, function(err, out){
    var not_found = err; // && out.toString().match('not found');
    cb(!not_found);
  })
}

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
        run_bin_prey(' -N', function(err, out){
         out.should.include(node_versions.local);
         done();
        })
      });
    });
  }

  describe('when local node binary is NOT present', function(){
    // Temporarily move the local node bin, we'll put it back later
    before(function(done){
      // Let's check, naturally if we have it...
      if(fs.existsSync(node_bin)) {
        fs.renameSync(node_bin, node_bin + '.tmp');
        fs.exists(node_bin, function(exists){
          exists.should.not.be.true;
          done();
        });
      } else {
        done();
      }
    });

    describe('and system node exists', function(){
      before(function(done){
        system_node_exists(function(e){
          e.should.be.true;
          done();
        });
      });

      it('uses system node binary', function(done){
        run_bin_prey(' -N', function(err, out){
          out.should.include(node_versions.system);
          done();
        });
      });
    });

    describe('and system node does not exist', function(){
      before(function(done){
        exec_env = { 'PATH': '/foo' };
        system_node_exists(function(exists){
          //exists.should.not.be.true;
          done();
        });
      });

      it('fails miserably', function(done){
        run_bin_prey(' -N', function(err, out){
          err.should.be.an.instanceOf(Error);
          err.code.should.be.equal(127);  // "command not found"
          out.should.be.a('string');
          out.should.have.length(0);
          done();
        });
      });

      after(function(){
        exec_env = process.env;
      });
    });

    // make sure the local bin is put back in place
    after(function(done){
      if(fs.existsSync(node_bin)) {
        fs.rename(node_bin + '.tmp', node_bin, done);
      } else {
        done();
      }
    });
  });

  describe('params', function(){
    // We will create a fake node bin so we can capture
    // the arguments with which it is called.
    // We also set the PATH variable to that dir, to make sure it's called
    before(function(done){
      exec_env = { 'PATH': os.tmpdir() };
      fs.writeFile(fake_node, 'echo $@', {mode: 0755}, done);
    });

    describe('when called with no params', function(){
      it('calls lib/agent/cli.js', function(done){
        run_bin_prey('', function(err, out){
          out.should.include('lib/agent/cli.js');
          done();
        });
      });
    });

    describe('when called with `config` param', function(){
      it('calls lib/conf/cli.js', function(done){
        run_bin_prey(' config', function(err, out){
          out.should.include('lib/conf/cli.js');
          done();
        });
      });

      it('it passes any other arguments too (eg. `config activate`)', function(done){
        run_bin_prey(' config activate', function(err, out){
          out.should.include('lib/conf/cli.js config activate');
          done();
        });
      });
    });

    describe('when called with `test` argument', function(){
      it('calls mocha', function(done){
        run_bin_prey(' test', function(err, out){
          out.should.include('node_modules/mocha/bin/mocha');
          done();
        });
      });

      it('it passes any other arguments too (eg. `--reporter nyan`)', function(done){
        run_bin_prey(' test --reporter nyan', function(err, out){
          out.should.include('node_modules/mocha/bin/mocha test --reporter nyan');
          done();
        });
      });
    });

    describe('when called with unknown argument', function(){
      it('calls lib/agent/cli.js', function(done){
        run_bin_prey(' hellomyfriend', function(err, out){
          out.should.include('lib/agent/cli.js');
          done();
        });
      });
    });

    after(function(done){
      exec_env = process.env;
      fs.unlink(fake_node, done);
    });
  });
});
