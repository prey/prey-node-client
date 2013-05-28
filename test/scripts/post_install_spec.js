
var fs                    = require('fs'),
    join                  = require('path').join,
    local_prey_path       = join(__dirname, '..', '..', 'bin', 'prey'),
    package_json_path     = join(__dirname, '..', '..', 'package.json'),
    post_install_path     = join(__dirname, '..', '..', 'scripts', 'post_install.js'),
    should                = require('should'),
    exec                  = require('child_process').exec,
    spawn                 = require('child_process').spawn,
    utils                 = require(join(__dirname, '..', 'lib', 'test_utils'));

describe('scripts/post_install_spec #wip', function(){

  if (process.platform == 'win32') {
    describe('when platform is windows', function(){

      it('should call bin/prey config hooks post_install');
    });
  } else {
    describe('when platform is not windows', function(){

      describe('when called as admin user (sudo npm -g install)', function(){

        // Temporarily move the local prey bin, we'll put it back later
        before(function(done){
          fs.renameSync(local_prey_path, local_prey_path + '.tmp');
          fs.writeFile(local_prey_path, 'echo $@', {mode: 0755}, done);
        });

        it('npm should call `scripts/post_install.js`', function(){
          /** We need to check package.json if it has the respective line
           *  NOTE: Please read the observations on running npm as [sudo]
           *        in the README.md
           *        As of 20130528, we need to issue the flag `unsafe-perm`
           **/
           var package_json_contents = JSON.parse(fs.readFileSync(package_json_path, 'utf8'));
           package_json_contents.scripts.postinstall.should.be.equal('node ./scripts/post_install.js');
        });

        it('and `scripts/post_install.js` should call `bin/prey config hook post_install', function(done){
          exec(post_install_path, function(error, stdout, stderr){
            stdout.should.match(/^config hooks post_install\n/)
            done();
          });
        });

        after(function(done){
          fs.unlinkSync(local_prey_path);
          fs.rename(local_prey_path + '.tmp', local_prey_path, done);
        });
      });

      describe('when called as a non-privileged user', function(){

        var non_root_user_id,
            exit_code;

        before(function(done){
          fs.renameSync(local_prey_path, local_prey_path + '.tmp');
          utils.get_non_root_user_id(function (user_id){
            non_root_user_id = user_id;
            done();
          });
        });

        it('should not call bin/prey', function(done){
          var post_install = spawn(post_install_path, [], {uid : non_root_user_id});
          fs.writeFileSync(local_prey_path, '#!/bin/bash\nkill -s SIGUSR2 ' + post_install.pid, {mode : 0755});

          post_install.on('close', function(code, signal){
            should.not.exist(signal); // `bin/prey` wasn't called!
            exit_code = code;         // So, we'll test it next
            done();
          });
        });

        it('should exit with error code (1)', function(){
          exit_code.should.be.equal(1);
        });

        after(function(done){
          fs.unlinkSync(local_prey_path);
          fs.rename(local_prey_path + '.tmp', local_prey_path, done);
        });
      });
    });
  }
});
