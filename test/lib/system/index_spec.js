var join       = require('path').join,
    should     = require('should'),
    sinon      = require('sinon'),
    needle     = require('needle'),
    cp         = require('child_process'),
    helpers    = require('../../helpers'),
    sys_index  = helpers.lib_path('system'),
    index      = require(sys_index),
    sys_mac    = require(join(sys_index, 'mac')),
    sys_win    = require(join(sys_index, 'windows')),
    sys_linux  = require(join(sys_index, 'linux')),
    is_windows = process.platform === 'win32';

describe('system functions', function() {

  describe('get_logged_user()', function() {

    describe('when there is no logged user', function() {
      it('returns an error');
    })

    describe('when there IS a logged user', function() {

      it('returns his username', function(done){
        index.get_logged_user(function(err, user){
          should.not.exist(err);
          should.exist(user);
          user.should.not.be.equal('');
          done();
        });
      });

    })

  });

  describe('get_admin_user()', function() {
    var exec_stub;

    before(function() {
      exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
        return cb(null, 'GroupMembership: root admin admin2');
      });
    });

    after(function() {
      exec_stub.restore();
    })

    describe('when the logged user is admin', function() {
      var logger_user_stub;

      before(function() {
        logger_user_stub = sinon.stub(sys_mac, 'find_logged_user').callsFake(cb => {
          return cb(null, 'admin2')
        })
      })

      after(function() {
        logger_user_stub.restore();
      })

      it('returns the logged user name', function(done) {
        sys_mac.find_admin_user(function(err, user) {
          should.not.exist(err);
          should.exist(user);
          user.should.not.be.equal('');
          user.should.be.equal('admin2');
          done();
        });
      });

    })

    describe('when the logged user is not admin', function() {
      var logger_user_stub;

      before(function() {
        logger_user_stub = sinon.stub(sys_mac, 'find_logged_user').callsFake(cb => {
          return cb(null, 'noadmin')
        })
      })

      after(function() {
        logger_user_stub.restore();
      })

      it('returns the logged user name', function(done){
        sys_mac.find_admin_user(function(err, user) {
          should.not.exist(err);
          should.exist(user);
          user.should.not.be.equal('');
          user.should.not.be.equal('noadmin');
          user.should.be.equal('admin');
          done();
        });
      });

    })

  });

  describe('check_service_availability', function() {

    describe('when is not available', function() {
      var get_stub;
      before(function() {
        sys_win.monitoring_service_go = false;
        get_stub = sinon.stub(needle, 'get').callsFake((host, cb) => {
          cb(new Error('ECONNREFUSED'));
        })
      })

      after(function() {
        get_stub.restore();
      })

      it ('returns error', function(done) {
        sys_win.check_service({}, function(err) {
          should.exist(err);
          sys_win.monitoring_service_go.should.be.equal(false);
          done();
        })
      })

    })

    describe('when is not available', function() {
      var spy_get;

      describe('when was available before', function() {

        before(function() {
          sys_win.monitoring_service_go = true;
          get_stub = sinon.stub(needle, 'get').callsFake((host, cb) => {
            cb(null);
          });
        })

        after(function() {
          get_stub.restore();
        })

        it ('does not returns error', function(done) {
          sys_win.check_service({}, function(err) {
            should.not.exist(err);
            done();
          })
        })
      })

      describe('when was not available before', function() {
        var get_stub;

        before(function() {
          sys_win.monitoring_service_go = false;
          get_stub = sinon.stub(needle, 'get').callsFake((host, cb) => {
            cb(null);
          });
        })

        after(function() {
          get_stub.restore();
        })

        it ('does not returns error', function(done) {
          sys_win.check_service({}, function(err) {
            should.not.exist(err);
            sys_win.monitoring_service_go.should.be.equal(true);
            done();
          })
        })
      })

    })
  });

  describe('tempfile_path()', function() {

    it('requires a filename')
    it('returns the full filename path')
    it('does not return a personal temp folder in the path')

  });

  describe('get_running_user()', function() {

    it('gets a value for the running user', function() {
      var user = index.get_running_user();
      user.length.should.be.above(0);
    });
  });

  describe('get_os_info() -> get_os_version + get_os_name', function() {

    it('returns properties [name, version, arch]', function(done){
      index.get_os_info(function(err, response){
        response.should.have.keys('name', 'version', 'arch');
        response.name.should.exist;
        done();
      })
    });
  });

  describe('get_os_name', function() {

    it('does not fail', function(done) {
      index.get_os_name(function(err, name) {
        should.not.exist(err);
        name.should.be.a.String;
        done();
      });
    });

  });

  describe('get_os_version', function() {

    it('does not fail', function(done) {
      index.get_os_version(function(err, version) {
        should.not.exist(err);
        version.should.be.a.String;
        done();
      });
    });

  });

  describe('process_running()', function() {

    it('should proxy to os function', function(done){
      var process_name = is_windows ? 'node.exe' : 'node';
      index.process_running(process_name, function(response){
        response.should.be.true;
        done();
      })
    });
  });

  describe('scan_networks()', function() {

    it('runs', function(done) {
      if (!is_windows) return done(); // windows only

      index.scan_networks(done);
    });

  });

  describe('get_python_version()', function() {

    describe('when os is windows or an error occurs', () => {

      it('keeps value as null', (done) => {
        sys_win.get_python_version((err, ver) => {
          should(err).be.null;
          should(ver).be.null;
          done();
        });
      })
    })

    describe('when os is mac or linux', () => {
      
      describe('when the cmd succeed', () => {
        before(function() {
          exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
            return cb(null, "2.7.16");
          });
        });
    
        after(function() {
          exec_stub.restore();
        })

        it('saves the python version', (done) => {
          sys_linux.get_python_version((err, ver) => {
            should(err).be.null;
            should(ver).not.be.null;
            done();
          });
        })
      });

      describe('when the cmd fail', () => {
        before(function() {
          exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
            return cb(new Error("Nope!"));
          });
        });
    
        after(function() {
          exec_stub.restore();
        })

        it('saves the python version', (done) => {
          sys_linux.get_python_version((err, ver) => {
            should(err).not.be.null;
            should(ver).be.null;
            done();
          });
        })
      });
    })

  });
});
