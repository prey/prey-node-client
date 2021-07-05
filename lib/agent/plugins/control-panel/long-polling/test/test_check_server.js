var assert = require('assert'),
  sinon = require('sinon'),
  should = require('should');
  test_server = require('./test_server'),
  os             = require('os'),
  server = require('./../server');

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
        os_name = 'linux';
        platform_stub  = sinon.stub(os, 'platform').callsFake(() => { return 'linux'; });
      })

      after(() => {
        platform_stub.restore();
      })

      it('should return null', function (done) {
        server.create_server(function (err,obj) {
          should.not.exist(obj)
          should.exist(err);
          err.message.should.containEql('Only for mac and windows');
          done();

        });
      });
    });

 describe('check service', function () {

    before(() => {  
        platform_stub  = sinon.stub(os, 'platform').callsFake(() => { return 'windows'; });
    })

    after(() => {
        platform_stub.restore();
    })

    it('should cb true whith', function (done) {
      server.check_service(function (resp) {
        console.log(cb)
        should.exist(resp);
        resp.should.be.equal(true);
        done();
      });
    });
  });


  describe('should kill server and up', function () {

    before(() => {  
      test_server.open(7738,function (params) {
      });
    })

    after(() => {
     test_server.close();
    })

    it('should write Localhost server on same port', function (done) {
      server.create_server(function (err,obj) {
        should.not.exist(obj)
        should.exist(err);
        done();

      });
    });
  });

})

