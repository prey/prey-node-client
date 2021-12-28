var helpers        = require('./../../../helpers'),
    os             = require('os'),
    should         = require('should'),
    sinon          = require('sinon'),
    join           = require('path').join,
    needle         = require('needle'),
    lib_path       = helpers.lib_path(),
    commands       = helpers.load('commands'),
    sys_index_path = helpers.lib_path('system'),
    sys_index      = require(sys_index_path),
    sys_win        = require(join(sys_index_path, 'windows')),
    encrypt_path   = join(lib_path, 'agent', 'actions', 'factoryreset'),
    factoryreset = require(encrypt_path);

describe('diskencryption', () => {

  describe('when os != windows', () => {
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

      describe('when the service is not available', () => {
        var id = "123";
        var opts = {}

        before(() => {
          sys_win.monitoring_service_go = false;
          check_service_stub = sinon.stub(sys_win, 'check_service').callsFake((url, cb) => {
            return cb(new Error("BUH!"));
          });
        });

        after(() => {
          check_service_stub.restore();
        })

        it('returns error', (done) => {
          factoryreset.start(id,opts, (err, em) => {
            em.on('end', (id,err, out) => {
              should.exist(err);
              err.message.should.containEql('Admin service not available');
              done();
            });
          });
        });
      });

     describe('when the service is available', () => {

        var opts = {}

        var id = "123"

        before(() => {
          sys_win.monitoring_service_go = true;
        })

        describe('when the action fails', () => {
          var spy_commands;
          before(() => {
            run_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
              return cb(new Error("Socket hang up"))
            })
            spy_commands = sinon.spy(commands, 'perform');
          })

          after(() => {
            run_stub.restore();
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
          })

          after(() => {
            run_stub.restore();
            commands_stub.restore();
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