var helpers        = require('./../../../helpers'),
    os             = require('os'),
    should         = require('should'),
    sinon          = require('sinon'),
    join           = require('path').join,
    needle         = require('needle'),
    lib_path       = helpers.lib_path(),
    commands       = helpers.load('commands'),
    tokens         = helpers.load('token'),
    sys_index_path = helpers.lib_path('system'),
    sys_index      = require(sys_index_path),
    sys_win        = require(join(sys_index_path, 'windows')),
    factoryreset_path   = join(lib_path, 'agent', 'actions', 'factoryreset'),
    factoryreset   = require(factoryreset_path),
    api            = require('./../../../../lib/agent/plugins/control-panel/api');
    

describe('factoryreset', () => {

  describe('when os != windows', () => {
    before(() => {
      sys_index.os_name = 'mac';
      platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'mac'; });
    });

    after(() => {
      platform_stub.restore();
    });
    var opts = {}
    var id ;
    it('returns an error', (done) => {
      factoryreset.start(id,opts, (err, em) => {
        should.exist(err);
        err.message.should.containEql('Action only allowed on Windows 1O');
        done();
      });
    })
  })

  describe('when os is windows', () => {

    before(() => {
      sys_index.os_name = "windows"
      sys_index.check_service = sys_win.check_service;
      sys_index.run_as_admin = sys_win.run_as_admin;
      platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
    })

    after(() => {
      platform_stub.restore();
    })

    describe('when the action has no options', () => {
      var opts = undefined
      var id ;
      it('returns an error', (done) => {
        factoryreset.start(id, opts, (err, em) => {
          should.exist(err);
          err.message.should.containEql('The factory reset data is not valid');
          done();
        })
      })
    })

    describe('reseting', () => {
      var run_stub,
        check_service_stub;
        
      describe('when the token is wrong', () => {
       var id = "123";
        var opts = { token : "abc" , target : 'factoryreset'  }

        beforeEach(function(){
          api.keys.set({ api: 'foobar', device : '12345' })
        })

        before(() => {
          sys_win.monitoring_service_go = false;
          check_token_service_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
            return cb(new Error('There was an error communicating with the server api Token'))
          });
        });

        after(() => {
          check_token_service_stub.restore();
        })

        it('token error', (done) => {
          factoryreset.start(id,opts, (err, em) => {
              should.exist(err);
              err.message.should.containEql('There was an error communicating with the server api Token');
              done();
          });
        });
      });

     describe('when the service is available', () => {

        var opts = { token : "abc" , target : 'factoryreset'  }
        var id = "123"

        beforeEach(function(){
          api.keys.set({ api: 'foobar', device : '12345' })
        })

        before(() => {
          sys_win.monitoring_service_go = true;
        })

        describe('when the action fails', () => {
          var spy_commands;
          before(() => {
            run_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
              return cb(new Error("Socket hang up"))
            })
            run_stub_token = sinon.stub(tokens, 'post_token').callsFake((opts, cb) => {
              return cb(null)
            })
            spy_commands = sinon.spy(commands, 'perform');
          })

          after(() => {
            run_stub.restore();
            run_stub_token.restore();
            spy_commands.restore();
          })

          it('notify error to the user and shouldnt ask for keys or status', (done) => {
            factoryreset.start(id,opts, (err, em) => {
              em.on('end', (id,err, out) => {
                should.exist(err);
                err.message.should.containEql('Socket hang up');
                spy_commands.notCalled.should.be.equal(true);
                done();
              })
            });
          })
        })

        describe('when the action is successful', () => {
          var body = '{"error":false, "output":{"error":false,"message":"SUCCESS: The scheduled task Prey Factory Reset has successfully been created","code":0}}'

          before(() => {
            run_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
              return cb(null, null, body)
            });
            commands_stub = sinon.stub(commands, 'perform').callsFake(() => {
              return;
            });
            run_stub_token = sinon.stub(tokens, 'post_token').callsFake((opts, cb) => {
              return cb(null)
            })
          })

          after(() => {
            run_stub.restore();
            commands_stub.restore();
            run_stub_token.restore();
          })

          it('notify success', (done) => {
            factoryreset.start(id,opts, (err, em) => {
              em.on('end', (id,err, out) => {
                should.not.exist(err);
                should.exist(out);
                out.data.should.be.equal(0);
                done();
              })
            });
          })
        })
      })
    })
  });
})