var should   = require('should'),
    sinon    = require('sinon'),
    join     = require('path').join,
    tmpdir   = require('os').tmpdir,
    helpers  = require('../../../helpers'),
    cp       = require('child_process'),
    hostname = helpers.load('triggers/hostname'),
    lib_path = helpers.lib_path(),
    api_path = join(lib_path, 'agent', 'plugins', 'control-panel', 'api');
    api      = require(api_path),
    request  = require(join(api_path, 'request')),
    storage  = require('../../../../lib/agent/utils/storage'),
    hooks    = helpers.load('hooks');

var opts = {};

describe('hostame', () => {
  before(done => {
    storage.init('keys', tmpdir() + '/keys_new.db', done);
  })

  after(done => {
    storage.erase(tmpdir() + '/keys_new.db', () => {
      hostname.stop();
      done();
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
      storage.do('all', {type: 'keys'}, (err, out) => {
        Object.keys(out).length.should.eql(0);
        
        hostname.start(opts, () => {});
        setTimeout(() => {
          storage.do('all', {type: 'keys'}, (err, out) => {  

            should.not.exist(err);
            out[0]['id'].should.exist;
            
            out[0]['value'].should.be.equal('John PC');
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
          storage.do('all', {type: 'keys'}, (err, out) => {  
            should.not.exist(err);
            out[0]['id'].should.exist
            out[0]['value'].should.be.equal('John PC');
            done();
          })
        })
      })
    })

    describe('And hostname changes', () => {
      var spy_push;
      var exec_stub;

      describe('and the client was connected', () => {

        before(() => {
          exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
            return cb(null, 'John PC 2');
          });
        })

        after(() => {
          exec_stub.restore();
          hostname.stop();
        })

        it('sends hostname changed event', (done) => {
          hostname.start(opts, (err, em) => {
            hooks.trigger('connected');
            em.on('device_renamed', (e) => {
              setTimeout(() => {
                //If goes through here means it worked!
                done();
              }, 1500)
            })
          })
        })
      });

      describe('and the client was disconnected and then connected', () => {

        before(() => {
          exec_stub = sinon.stub(cp, 'exec').callsFake((cmd, cb) => {
            return cb(null, 'John PC 3');
          });
        })

        after(() => {
          exec_stub.restore();
          hostname.stop();
        })

        it('sends the event after is connected', function(done) {
          this.timeout(5000);
          hostname.start(opts, (err, em) => {
            em.on('device_renamed', (e) => {
              done();
            })
            hooks.trigger('disconnected');
            setTimeout(() => {
              hooks.trigger('connected');
            }, 2000)
          });
        })
      });
    })
  })
})
