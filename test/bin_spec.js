var sinon   = require('sinon'),
    should  = require('should'),
    path    = require('path'),
    fs      = require('fs'),
    exec    = require('child_process').exec;

var exec_env = process.env, // so we can override it later
    node_versions = {},
    bin_path = path.join(__dirname, '..', 'bin'),
    bin_prey = path.join(bin_path, 'prey'),
    node_bin = path.join(bin_path, 'node'),
    local_present = fs.existsSync(node_bin);

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
  })

  if (local_present) { // no point in checking if it's not there

    describe('when local node binary is present', function(){

      before(function(done){
         fs.exists(node_bin, function(exists){
          exists.should.be.true;
          done();
        })
      })

      it('uses local node binary', function(done){
        run_bin_prey(' -N', function(err, out){
         out.should.include(node_versions.local);
         done();
        })
      })

      it('with unknown argument');
      it('with test argument');
      it('with config argument');

    })

  }

  describe('when local node binary is NOT present', function(){

    // temporarily move the local node bin, we'll put it back later
    before(function(done){
       fs.renameSync(node_bin, node_bin + '.tmp');
       fs.exists(node_bin, function(exists){
        exists.should.not.be.true;
        done();
      })
    })

    // make sure the local bin is put back in place
    after(function(done){
      fs.rename(node_bin + '.tmp', node_bin, done);
    })

    describe('and system node exists', function(){

      before(function(done){
        system_node_exists(function(e){
          e.should.be.true;
          done();
        })
      })

      it('uses system node binary', function(){
        run_bin_prey(' -N', function(err, out){
          out.should.include(node_versions.system);
        })
      })

      it('with unknown argument');
      it('with test argument');
      it('with config argument');

    })

    describe('and system node does not exist', function(){

      before(function(done){
        exec_env = { 'PATH': '/foo' };
        system_node_exists(function(exists){
          exists.should.not.be.true;
          done();
        })
      })

      after(function(){
        exec_env = process.env;
      })

      it('fails miserably', function(done){
        run_bin_prey(' -N', function(err, out){
          out.toString().should.not.include(node_versions.local);
          out.toString().should.not.include(node_versions.system);
          err.should.be.an.instanceOf(Error);
          done();
        })
      })

    })

  })


})
