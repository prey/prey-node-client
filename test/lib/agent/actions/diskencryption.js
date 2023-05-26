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
    encrypt_path   = join(lib_path, 'agent', 'actions', 'diskencryption'),
    diskencryption = require(encrypt_path);

describe('diskencryption', () => {

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
      diskencryption.start(id, opts, (err, em) => {
        should.exist(err);
        err.message.should.containEql('Action only allowed on Windows 1O');
        done();
      });
    });
  })

  describe('when os is windows', () => {

    before(() => {
      sys_index.os_name = "windows"
      sys_index.check_service = sys_win.check_service;
      sys_index.run_as_admin = sys_win.run_as_admin;
      platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
    });

    after(() => {
      platform_stub.restore();
    });

    describe('when the action has no options', () => {
      var opts = {}
      var id ;
      it('returns an error', (done) => {
        diskencryption.start(id, opts, (err, em) => {
          should.exist(err);
          err.message.should.containEql('The encryption data is not valid');
          done();
        })
      })
    })

    describe('on encrypt', () => {
      var run_stub,
        check_service_stub;

      describe('when the service is not available', () => {
        var id = "123";
        var opts = {
          encryption: true,
          disks: ["C:", "D:"],
          full_disk: true,
          encryption_method: "XtsAes128"
        }

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
          diskencryption.start(id, opts, (err, em) => {
            em.on('end', (id, err, out) => {
              should.exist(err);
              err.message.should.containEql('Admin service not available');
              done();
            });
          });
        });
      });

      describe('when the service is available', () => {

        var opts = {
          encryption: true,
          disks: ["C:", "D:"],
          full_disk: true,
          encryption_method: "XtsAes128"
        }

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
            diskencryption.start(id,opts, (err, em) => {
              em.on('end', (id,err, out) => {
                should.exist(err);
                err.message.should.containEql('Socket hang up');
                spy_commands.notCalled.should.be.equal(true);
                done();
              })
            });
          })
          
        })

        describe('when one of the disks fails', () => {
          var body = '{"error":false, "output":[{"disk":"F:","error":true,"message":"Unable to change security stantard on a encrypted disk","code":4}]}'

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

          it('notify error to the user', (done) => {
            diskencryption.start(id,opts, (err, em) => {
              em.on('end', (id,err, out) => {
                should.not.exist(err);
                should.exist(out);
                out["F"].should.be.equal(4);
                done();
              })
            });
          })
        })

        describe('when the action is successful', () => {
          var body = '{"error":false, "output":[{"disk":"F:","error":false,"message":"131109-711788-396044-252307-256025-025751-442673-632753","code":0},{"disk":"G:","error":false,"message":"066308-169246-491909-718883-621621-498630-519673-191631","code":0}]}'

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
            diskencryption.start(id,opts, (err, em) => {
              em.on('end', (id,err, out) => {
                should.not.exist(err);
                should.exist(out);
                out["F"].should.be.equal(0);
                out["G"].should.be.equal(0);
                done();
              })
            });
          })
        })
      })
    })

    describe('on decrypt', () => {
      var opts = {
        encryption: false,
        disks: [["C:", "12345-67890"], ["D:", "9876-5432"]]
      }

      var id = "123"

      describe('when the password is incorrect', () => {
        var body = '{"error":false, "output":[{"disk":"F:","error":true,"message":"Incorrect unlock password","code":7}]}'

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

        it('notify incorrect password error to the user', (done) => {
          diskencryption.start(id,opts, (err, em) => {
            em.on('end', (id,err, out) => {
              should.not.exist(err);
              should.exist(out);
              out["F"].should.be.equal(7);
              done();
            })
          });
        })
      });

      describe('when the password is correct', () => {
        var body = '{"error":false, "output":[{"disk":"F:","error":false,"code":0}]}';

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
          diskencryption.start(id,opts, (err, em) => {
            em.on('end', (id,err, out) => {
              should.not.exist(err);
              should.exist(out);
              out["F"].should.be.equal(0);
              done();
            })
          });
        });
      });
    });
  });
})