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
      exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
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
        
        hostname.start(opts, () => {});
        setTimeout(() => {
          storage.all('keys', (err, out) => {
            should.not.exist(err);
            out['hostname-key'].should.exist
            out['hostname-key'].value.should.be.equal('John PC');
            done();
          })
        }, 2000)
      })
    })

  })

  describe('When there is a stored hostname', () => {
    describe('And hostname remains the same', () => {
      var spy_push;
      var exec_stub;

      before(() => {
        spy_push = sinon.stub(api.push, 'event').callsFake((keys, cb) => { return cb(); });
        exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
          return cb(null, 'John PC');
        });
      })

      after(() => {
        spy_push.restore();
        exec_stub.restore();
        hostname.stop();
      })
      
      it ('doesnt send event', (done) => {
        hostname.start(opts, () => {
          spy_push.notCalled.should.be.equal(true);
          storage.all('keys', (err, out) => {
            should.not.exist(err);
            out['hostname-key'].should.exist
            out['hostname-key'].value.should.be.equal('John PC');
            done();
          })
        })
      })
    })

    describe('And hostname changes', () => {
      var spy_push;
      var exec_stub;

      before(() => {
        spy_push = sinon.stub(api.push, 'event').callsFake((keys, cb) => { return cb(); });
        exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
          return cb(null, 'John PC 2');
        });
      })

      after(() => {
        spy_push.restore();
        exec_stub.restore();
        hostname.stop();
      })

      it('sends hostname changed event', (done) => {
        hostname.start(opts, () => {})
        spy_push.notCalled.should.be.equal(true);
        
        setTimeout(() => {
          storage.all('keys', (err, out) => {
            should.not.exist(err);
            out['hostname-key'].should.exist
            out['hostname-key'].value.should.be.equal('John PC 2');
            done();
          })
        }, 1000)
      })
    })
  })
})
