
var join        = require('path').join,
    should      = require('should'),
    sinon       = require('sinon'),
    helpers     = require('../../helpers'),
    index_path  = join(helpers.lib_path('system', 'index.js')),
    is_windows  = process.platform === 'win32';

describe('main system functions', function(){

  var index = require(index_path);

  describe('get_logged_user()', function(){

    describe('when there is no logged user', function(){
      it('returns an error');
    })

    describe('when there IS a logged user', function(){

      it('returns the logged user', function(done){
        index.get_logged_user(function(err, user){
          should.not.exist(err);
          should.exist(user);
          user.should.not.be.equal('');
          done();
        });
      });

    })

  });

  describe('tempfile_path()', function(){
    it('returns the path of a file over a tmp directory', function(){
      var filepath = index.tempfile_path('foobar.txt');
      var tmp_path   = is_windows ? process.env.WINDIR + '\\Temp' : '/tmp';
      filepath.should.equal(join(tmp_path, 'foobar.txt'));
    });
  });

  describe('spawn_as_logged_user()', function(){

    it('issues a `whoami` using the function', function(done){
      index.spawn_as_logged_user('whoami', [], function(err, spawned_item){
        var response = '';

        spawned_item.stdout.on('data', function (data){
          response += data.toString('utf8');
        });

        spawned_item.on('close', function (code){
          response.length.should.be.above(0);
          code.should.be.equal(0);
          done();
        });
      });
    });
  });
  describe('run_as_logged_user()', function(){

    it('issues a `whoami` using the function', function(done){
      index.run_as_logged_user('whoami', [], function(err, response){
        should.not.exist(err);
        response.length.should.be.above(0);
        done();
      });
    });
  });

  describe('get_running_user()', function(){

    it('gets a value for the running user', function(){
      var user = index.get_running_user();
      user.length.should.be.above(0);
    });
  });

  describe('get_os_info() -> get_os_version + get_os_name', function(){

    it('returns properties [name, version, arch]', function(done){
      index.get_os_info(function(err, response){
        response.should.have.keys('name', 'version', 'arch');
        response.name.should.exist;
        done();
      })
    });
  });

  describe('get_os_name', function(){

    it('gets os name', function(done) {
      index.get_os_name(function(err, name) {
        should.not.exist(err);
        name.should.be.a.String;
        done();
      });
    });

  });

  describe('get_os_version', function(){

    it('gets os version', function(done) {
      index.get_os_name(function(err, version) {
        should.not.exist(err);
        version.should.be.a.String;
        done();
      });
    });

  });

  describe('set_interval()', function(){

    describe('when there is NOT an interval set', function(){

      var get, set;

      before(function(){
        get = sinon.stub(index.delay, 'get', function(cb){
          cb()
        });
        set = sinon.stub(index.delay, 'set', function(delay, cb){
          cb(null, delay);
        });
      });

      after(function(){
        get.restore();
        set.restore();
      });

      it('should set and interval', function(done){
        index.set_interval(34, function(err){
          should.not.exist(err);
          done();
        });
      });

    });

    describe('when there is an interval already set', function(){

      describe('and current delay is every 60 minutes', function(){

        describe('and a lower one was requested', function(){

          var get, set;

          before(function(){
            get = sinon.stub(index.delay, 'get', function(cb){
              cb({ value : 0,  one_hour: 1 });
            });
            set = sinon.stub(index.delay, 'set', function(delay, cb){
              cb(null, delay);
            });
          });

          after(function(){
            get.restore();
            set.restore();
          });

          it('should update the interval', function(done){
            index.set_interval(37, function(err){
              should.not.exist(err);
              done();
            });
          });

        });

        describe('and a delay higher than 60 (one hour) was requested', function(){

          var get, set;

          before(function(){
            get = sinon.stub(index.delay, 'get', function(cb){
              cb({ value : 0,  one_hour: 1 });
            });
            set = sinon.stub(index.delay, 'set', function(delay, cb){
              cb(null, delay);
            });
          });

          after(function(){
            get.restore();
            set.restore();
          });

          it('should do nothing', function(done){
            index.set_interval(70, function(err, current){
              should.not.exist(current);
              done();
            });
          });

        });

      });

    });

  });

  describe('unset_interval()', function(){
    var unset;

    before(function(){
      unset = sinon.stub(index.delay, 'unset', function(cb){
        cb(null, 'OK');
      });
    });

    after(function(){
      unset.restore();
    });

    it('should call the respective function `system.delay.unset()`', function(done){
      index.unset_interval(function(err, stdout){
        stdout.should.be.equal('OK');
        done()
      })
    });

  });

  describe('process_running()', function(){

    it('should proxy to os function', function(done){
      var process_name = is_windows? 'svchost.exe' : 'bin';
      index.process_running(process_name, function(response){
        response.should.be.equal(true);
        done();
      })
    });
  });

  describe('auto_connect()', function(){

    var reconnect;

    before(function(){
      reconnect = sinon.stub(index, 'reconnect', function(cb) {
        cb();
      });
    });

    after(function(){
      reconnect.restore();
    });

    it.skip('should proxy to os function', function(done){
      this.timeout(10000);
      index.auto_connect(function(out){
        reconnect.calledOnce.should.be.true;
        out.should.be.equal(true);
        done();
      });
    });

  });

});
