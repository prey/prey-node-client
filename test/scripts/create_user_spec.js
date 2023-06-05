
// This test is only workable for ´nix´ os
if (process.platform == 'win32') return;

// This full suite is only for root users
if (process.getuid() !== 0) return;

var fs                    = require('fs'),
    join                  = require('path').join,
    script_filename       = join(__dirname, '..', '..', 'scripts', 'create_user.sh'),
    script_tmp_filename   = join('/','tmp', '6a0e1b190570da9f0fe1ab50fbdab035_create_user.sh'),
    test_username         = 'test___prey',
    sudoers_filename      = '/etc/sudoers.d/50_' + test_username +'_switcher',
    os_name               = process.platform === 'darwin' ? 'mac' : 'linux',
    exec                  = require('child_process').exec,
    spawn                 = require('child_process').spawn,
    utils                 = require(join(__dirname, '..', 'utils','test_utils'));

describe('scripts/create_user_spec', function(){

  describe('without sudo privileges', function(){

    var non_root_user_id;

    before(function(done){
      // 1. Get a non-root user-id
      utils.get_non_root_user_id(got_id);

      // 2. Copy the script contents into a `/tmp` file
      function got_id(user_id) {
        non_root_user_id = user_id;
        var create_user_contents = fs.readFileSync(script_filename, 'utf8');
        fs.writeFile(script_tmp_filename, create_user_contents, wrote_file);
      }

      // 3. And give this user we got ownership of the file
      function wrote_file() {
        fs.chown(script_tmp_filename, non_root_user_id, 0, done);
      }
    });

    it('exits with error code (1)', function(done){
      var create_user = spawn(script_filename, ['johndoe'], {uid : non_root_user_id});

      create_user.on('close', function(code){
        code.should.be.equal(1);
        done();
      });
    });

    after(function(done){
      fs.unlink(script_tmp_filename, done);
    });
  });

  describe('with sudo privileges', function(){

    describe('with no arguments', function(){

      var number_of_users_before_test;

      before(function(done){
        utils.count_users_in_system(function(count){
          number_of_users_before_test = count;
          done();
        });
      });

      it('exits with error code (1)', function(done){
        var create_user = spawn(script_filename, []);

        create_user.on('close', function(code){
          code.should.be.equal(1);
          done();
        });
      });

      it('does not create any `default` user (system user count should remain the same)', function(done){
        utils.count_users_in_system(function(count){
          count.should.be.equal(number_of_users_before_test);
          done();
        })
      });
    });

    describe('with `username` argument', function(){

      describe('and user exists', function(){

        before(function(done){
          utils.create_user(test_username, done);
        });

        it('exits with error code (1)', function(done){
          var create_user = spawn(script_filename, [test_username]);

          create_user.on('close', function(code){
            code.should.be.equal(1);
            done();
          });
        });

        after(function(done){
          utils.remove_user(test_username, done);
        });
      });

      describe('and user does not exists', function(){

        it('creates the user', function(done){
          this.timeout(10000);
          var create_user = spawn(script_filename, [test_username]);

          create_user.on('close', function(code){
            code.should.be.equal(0);
            done();
          });
        });

        if (os_name === 'linux') {
          it('adds the user to adm, netdev groups', function(done){
            exec('id ' + test_username, function (error, stdout){
              stdout.should.match(/(adm)/);
              stdout.should.match(/(netdev)/);
              done();
            })
          });
        }

        describe('with created user', function(){

          var impersonator_id;

          before(function(done){
            utils.get_user_id(test_username, function (_id){
              impersonator_id = _id;
              done();
            })
          });

          it('should be able to impersonate another user', function(done){
            utils.get_another_username(test_username, function(impersonated_username){
              var impersonate_test =
                spawn('sudo',
                      ['-n', 'su', impersonated_username, '-c', 'whoami'],
                      { uid : impersonator_id });

              impersonate_test.on('close', function(code){
                code.should.be.equal(0);
                done();
              });
            });
          });

          it('should NOT be able to impersonate root', function(done){
            var impersonate_test =
              spawn('sudo',
                    ['-n', 'su', global, '-c', 'whoami'],
                    { uid : impersonator_id });
            impersonate_test.on('close', function(code){
              code.should.be.equal(1);
              done();
            });
          });
        });

        after(function(done){
          utils.remove_user(test_username, function(){
            fs.unlink(sudoers_filename, done);
          });
        });
      });
    });
  });
});
