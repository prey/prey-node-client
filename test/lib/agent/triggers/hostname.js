var should   = require('should'),
    sinon    = require('sinon'),
    join     = require('path').join,
    tmpdir   = require('os').tmpdir,
    helpers  = require('./../../../helpers'),
    cp       = require('child_process'),
    hostname = helpers.load('triggers/hostname'),
    lib_path = helpers.lib_path(),
    api_path = join(lib_path, 'agent', 'plugins', 'control-panel', 'api');
    api      = require(api_path),
    push     = require(join(api_path, 'push')),
    storage  = require(helpers.lib_path('agent', 'utils', 'storage'));

var opts = {};

describe('hostame', () => {

  before(done => {
    storage.init('keys', tmpdir() + '/keys', done);
  })

  after(done => {
    storage.close('keys', () => {
      storage.erase(tmpdir() + '/keys', () => {
        hostname.stop();
        done();
      });
    });
  })
  
  describe('When there is no stored hostname', () => {
    var exec_stub;
    before(() => {
      exec_stub = sinon.stub(cp, 'exec', (cmd, cb) => {
        return cb(null, 'John PC');
      });
    })

    after(() => {
      exec_stub.restore();
      hostname.stop();
    })

    it('Stores the hostname', done => {
      storage.all('keys', function(err, out) {
        Object.keys(out).length.should.eql(0);
        
        hostname.start(opts, () => {
          storage.all('keys', (err, out) => {
            should.not.exist(err);
            out['hostname-key'].should.exist
            out['hostname-key'].value.should.be.equal('John PC');
            done();
          })
        })
      })
    })

  })

  describe('When there is a stored hostname', () => {
    var exec_stub;
    var push_stub
    var spy_push;


    describe('And hostname remains the same', () => {

      before(() => {
        spy_push = sinon.spy(hostname, 'push_event');
        exec_stub = sinon.stub(cp, 'exec', (cmd, cb) => {
          return cb(null, 'John PC');
        });
      })

      after(() => {
        spy_push.restore();
        exec_stub.restore();
      })
      
      it ('doesnt send event', (done) => {
        hostname.check_hostname();
        setTimeout(() => {
          spy_push.notCalled.should.be.equal(true);
          storage.all('keys', (err, out) => {
            should.not.exist(err);
            out['hostname-key'].should.exist
            out['hostname-key'].value.should.be.equal('John PC');
            done();
          })  
        }, 500)
      })
    })

    describe('And hostname changes', () => {

      before(() => {
        spy_push = sinon.spy(hostname, 'push_event');
        push_stub = sinon.stub(push, 'event', (data, opts) => {
          return true;
        });
        exec_stub = sinon.stub(cp, 'exec', (cmd, cb) => {
          return cb(null, 'John PC 2');
        });
      })

      after(() => {
        spy_push.restore();
        exec_stub.restore();
        push_stub.restore();
      })

      it('sends hostname changed event', (done) => {
        hostname.check_hostname();
        setTimeout(() => {
          spy_push.calledOnce.should.be.equal(true);
          storage.all('keys', (err, out) => {
            should.not.exist(err);
            out['hostname-key'].should.exist
            console.log(out['hostname-key'].value)
            out['hostname-key'].value.should.be.equal('John PC 2');
            done();
          })  
        }, 2000)
      })

    })

  })
})
