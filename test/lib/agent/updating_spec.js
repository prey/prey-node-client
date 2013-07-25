
var join                = require('path').join,
    fs                  = require('fs'),
    sandbox             = require('sandboxed-module'),
    common_path         = join(__dirname, '..', '..', '..', 'lib', 'agent', 'common'),
    package_path        = join(__dirname, '..', '..', '..', 'lib', 'conf', 'package'),
    package_json_path   = join(__dirname, '..', '..', '..', 'package.json')
    updater_path        = join(__dirname, '..', '..', '..', 'lib', 'agent', 'updater'),
    tmp_file_path       = join('/', 'tmp', '818184685129d5a05c96dc5725a61f56.txt');

describe('updating', function(){

  describe('when there is versions support', function(){
    // Suite Variables
    var common,
        package,
        updater,
        flag_package_check_latest_version_called = false;

    before(function(){
      common                = require(common_path);
      system                = common.system;
      system.paths.versions = 'true'; // So we can modify `can_upgrade`
      package               = {
        check_latest_version : function () {
          flag_package_check_latest_version_called = true;
          return;
        }
      }
      var sandbox_options   = { requires : {} };
      sandbox_options.requires['./common']    = common;
      sandbox_options.requires[package_path]  = package;
      updater = sandbox.require(updater_path, sandbox_options);
    });

    it('checks the latest version on amazon', function (){
      updater.check();
      flag_package_check_latest_version_called.should.be.equal(true);
    });

    describe('when current version is older', function(){

      before(function(){
        common.helpers.is_greater_than = function () {
          return true;
        }
        package           = {
          check_latest_version : function (callback) {
            callback(null, 'x.y.z');
          }
        }
        system                    = common.system;
        system.paths.package_bin  = join(__dirname, '..', '..', '..', 'test', 'utils', 'fake_bin_prey_empty');
        var sandbox_options       = { requires : {} };
        sandbox_options.requires['./common']    = common;
        sandbox_options.requires[package_path]  = package;
        updater = sandbox.require(updater_path, sandbox_options);
      });

      it('calls `bin/prey config upgrade` ', function (done){
        updater.check(function (updater_err){
          fs.readFile(tmp_file_path, 'utf8', function (err, data){
            updater_err.message.should.match(/Update failed/);
            data.should.match(/config upgrade/);
            done();
          });
        });
      });

      after(function(done){
        fs.unlink(tmp_file_path, done);
      });
    });
  });

  describe('when there is NOT versions support', function(){
    // Suite Variables
    var updater;

    before(function(){
      var common            = require(common_path);
      system                = common.system;
      system.paths.versions = false; // So we can modify `can_upgrade`
      var sandbox_options   = { requires : {} };
      sandbox_options.requires['./common'] = common;
      updater = sandbox.require(updater_path, sandbox_options);
    });

    it('exit with error', function (done){
      updater.check(function(err){
        err.message.should.be.equal("No versions support.");
        done();
      });
    });
  });
});
