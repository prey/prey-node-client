
var join            = require('path').join,
    sandbox         = require('sandboxed-module'),
    updater_path    = join(__dirname, '..', '..', '..', 'lib', 'agent', 'updater');

describe('updating', function(){

  describe('when auto-update is enabled', function(){

    it('checks the latest version on npm');

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

  describe('when auto-update is not enabled', function(){

    // Suite Variables
    var updater,
        flag_package_check_latest_version_called = false;

    before(function(){
      var common = require(join(__dirname, '..', '..', '..', 'lib', 'agent', 'common'));
      common.config.get = function(){ return false; };
      var package = {
        check_latest_version : function () {
          flag_package_check_latest_version_called = true;
        }
      }
      var sandbox_options = {};
      sandbox_options.requires = {};
      sandbox_options.requires['./common'] = common;
      sandbox_options.requires[join(__dirname, '..', '..', '..', 'lib', 'conf', 'package')] = package;

      updater = sandbox.require(updater_path, sandbox_options);
    });

    it('does not check the latest version', function (done){
      updater.check(function(){
        // cb() should be called
        Object.keys(arguments).length.should.be.equal(0);
        // package.check_latest_version shouldn't be called
        flag_package_check_latest_version_called.should.be.equal(false)
        done();
      });
    });
  });
});
