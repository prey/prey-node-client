
// This test is only workable for ´nix´ os
if (process.platform == 'win32') return;

// This full suite is only for root users
if (process.getuid() !== 0) return;

var fs                    = require('fs'),
    join                  = require('path').join,
    script_filename       = join(__dirname, '..', '..', 'scripts', 'create_user.sh'),
    script_tmp_filename   = join('/','tmp', '6a0e1b190570da9f0fe1ab50fbdab035_create_user.sh')
    spawn                 = require('child_process').spawn,
    utils                 = require(join(__dirname, '..', 'lib','test_utils'));

describe('create_user_spec', function(){

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

    it('exits with error code 1', function(done){
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

  describe('with no arguments #wip', function(){

    var number_of_users_before_test;

    before(function(done){
      utils.count_users_in_system(function(count){
        number_of_users_before_test = count;
        done();
      });
    });

    it('exits with error code', function(done){
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

  describe('with sudo privileges', function(){

    describe('and user exists', function(){

      it('exists with error code');
    });

    describe('and user does not exists', function(){

      it('creates the user');
      it('adds the user to adm, netdev groups');

      describe('with created user', function(){

        it('should be able to impersonate another user');
        it('should NOT be able to impersonate root');
      })
    });
  });
});
