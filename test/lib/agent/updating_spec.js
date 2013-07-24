
var join            = require('path').join,
    sandbox         = require('sandboxed-module'),
    common_path     = join(__dirname, '..', '..', '..', 'lib', 'agent', 'common'),
    package_path    = join(__dirname, '..', '..', '..', 'lib', 'conf', 'package'),
    updater_path    = join(__dirname, '..', '..', '..', 'lib', 'agent', 'updater');

describe('updating', function(){

  describe('when there is versions support', function(){
    it('checks the latest version on amazon');

    describe('when current version is older', function(){

      describe('and has not write permissions', function(){

        it('does not update the package');
      });

      describe('and has write permissions', function(){

        it('updates the package');

        describe('and the config file was modified', function(){

          describe('and has no write permissions', function(){

            it('leaves the file untouched');
          })

          describe('and has write permissions', function(){

            it('adds new keys if any');

            it('does not replace any existing values');

            it('updates for existing keys');
          });
        });

        it('exits the program');
      });
    });
  });

  describe('when there is NOT versions support', function(){
    // Suite Variables
    var updater,
        flag_package_check_latest_version_called = false;

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
