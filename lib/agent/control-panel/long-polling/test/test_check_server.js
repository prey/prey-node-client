var assert      = require('assert'),
    sinon       = require('sinon'),
    should      = require('should');
    test_server = require('./test_server'),
    os          = require('os'),
    sys_win     = require('../../../../../system/windows/index'),
    server      = require('./../server');

describe('test_server', function () {
  
  describe('create server', function () {

    describe('up server', function () {
      
      before(() => {
        spy_store = sinon.spy(server, 'check_server_down');
      })
  
      after(() => {
        spy_store.restore();
        server.close();
      })  

      it('should callback status code 200', (done) => {
        server.create_server(function (err, obj) {
          should.not.exist(err);
          spy_store.calledOnce.should.be.true;
          server.close();
          done();
        });
      });
    })
  })
 
  describe('is linux', function () {

    before(() => {
      osName = 'linux';
      platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'linux'; });
    })

    after(() => {
      platform_stub.restore();
    })

    it('should return null', function (done) {
      server.create_server(function (err,obj) {
        should.not.exist(obj)
        should.exist(err);
        err.message.should.containEql('Service only available for mac and windows');
        done();
      });
    });
  });

  describe('check service', function () {
    var sys_win_stub;
    before(() => {
      platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'windows'; });
      sys_win_stub = sinon.stub(sys_win, 'get_winsvc_version').callsFake((cb) => {
        cb(null, "1.2.1");
      });
    })

    after(() => {
      platform_stub.restore();
      sys_win_stub.restore();
    })

    it('should cb true', function (done) {
      server.check_service(function (resp) {
        should.exist(resp);
        resp.should.be.equal(true);
        done();
      });
    });
  });

  // describe('should kill server create a new one', function () {

  //   before(() => {
  //     test_server.open(7738,function (params) {
  //     });
  //   })

  //   after(() => {
  //    test_server.close();
  //   })

  //   it('should write Localhost server on same port', function (done) {
  //     server.create_server(function (err,obj) {
  //       should.not.exist(obj)
  //       should.exist(err);
  //       done();

  //     });
  //   });
  // });

})

