var should        = require('should'),
    path          = require('path'),
    fs            = require('fs'),
    exec          = require('child_process').exec,
    spawn         = require('child_process').spawn,
    is_windows    = process.platform == 'win32';

var exec_env      = process.env, // so we can override it later
    node_versions = {},
    bin_path      = path.join(__dirname, '..', 'bin'),
    bin_prey      = path.join(bin_path, 'prey'),
    node_bin      = path.join(bin_path, 'node'),
    local_present = fs.existsSync(node_bin);

if (is_windows) {
  node_bin  += '.exe';
  bin_prey  += '.cmd';
}

function run_bin_prey(args, cb) {
  console.log("bin_prey:",bin_prey)
  console.log("args:",args)
  var child = spawn(bin_prey, args, { env: exec_env });

  var out = '', err = '';

  child.stdout.on('data', function(data){
  //console.log("child on:",data)
  console.log("child on:")

    out += data;
  })

  child.stderr.on('data', function(data){
  console.log("child stderr:",data)
    err += data;
  })

  child.on('exit', function(code){
  console.log("child code:",code)
    cb(code, out, err)
  })

  setTimeout(function(){
  console.log("child kill:")
    child.kill()
  }, 1500);
}

describe('bin/prey', function(){

  before(function(done) {
    exec('"' + node_bin + '" -v', function(err, out) {
      console.log("bide bin err: ",err)
      console.log("bide bin out: ",out)
      if (!err) node_versions.local = out.toString().trim();
      done();
    })
  });

  if (local_present) { // no point in checking if it's not there

    describe('when local node binary is present', function(){

      // check, just in case
      before(function(done){
         fs.exists(node_bin, function(exists) {
          exists.should.be.true;
          done();
        });
      });

      it('uses local node binary', function(done){
        run_bin_prey(['-N'], function(code, out, err) {
          console.log("run_bin_prey code:",code)
          console.log("run_bin_prey out:",out)
          console.log("run_bin_prey err:",err)
          code.should.equal(0);
          out.should.containEql(node_versions.local);
          done();
        })
      });
    });

  }

  // To test params, we create a fake node bin so we can capture
  // the arguments with which it is called.
  // We also set the PATH variable to that dir, to make sure it's called
/*
  describe('params', function(){

    describe('when called -h param', function(){

      it('calls lib/agent/cli.js', function(done){
        run_bin_prey(['-h'], function(code, out, err){
          out.should.containEql('--logfile');
          done();
        });
      });

    });

    describe('when called with `config` param', function(){

      it('calls lib/conf/cli.js', function(done){
        run_bin_prey(['config'], function(code, out){
          out.should.containEql('config');
          out.should.containEql('activate');
          out.should.containEql('plugins');
          done();
        });
      });

      it('passes any other arguments too (eg. `config activate`)', function(done){
        run_bin_prey(['config', 'account'], function(code, out){
          out.should.containEql('verify');
          out.should.containEql('signup');
          done();
        });
      });
    });

    describe('when called with unknown argument', function(){
      it('returns unknown option', function(done){
        run_bin_prey(['--hellomyfriend'], function(err, out, stderr){
          stderr.should.containEql('unknown option');
          done();
        });
      });
    });

  });
*/
});
