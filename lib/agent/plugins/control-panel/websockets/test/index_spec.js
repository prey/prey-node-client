var assert  = require('assert'),
    sinon   = require('sinon'),
    should  = require('should'),
    tmpdir  = require('os').tmpdir,
    api     = require('../../api'),
    keys    = api.keys,
    websocket = require('..'),
    hooks   = require('../../../../hooks'),
    common  = require('../../../../../common'),
    commands  = require('../../../../commands'),
    actions  = require('../../../../actions'),
    status  = require('./../../../../triggers/status'),
    storage2 = require('./../../../../utils/storage'),
    tmpdir  = require('os').tmpdir,
    EventEmitter = require('events').EventEmitter,
    // server       = require('./../server'),
    test_server  = require('./test_server');


var server_port = 13375,
    prey_cfg = {
      host: 'localhost:' + server_port,
      protocol: 'http',
      api_key: 'asdfzomgbbq',
      device_key: 'notkey'
    };

// request.use(prey_cfg);

var common_obj = {
  hooks: hooks,
  config: {
    get: (key) => {
      if (key == 'protocol') return prey_cfg.protocol;
      if (key == 'host')     return prey_cfg.host;
    }
  },
  logger: common.logger,
  system: common.system
};

var spy,
    keys_stub,
    status_stub,
    server_stub,
    server;

function load(cb) {
  websocket.load.call(common_obj, function(err, em) {
    em.on('command', commands.perform)
    cb(err, em, spy);
  });
}

function unload(cb) {
  websocket.unload.call(common_obj, function(unloaded) {
    if (cb) return cb(unloaded);
  });
}

function server_up() {
  server = test_server.open(server_port);
}

function server_down(cb) {
  // if (server) {
    test_server.close();
    server = null;
    cb();
  // }
}

describe('websocket', function() {

  before(function() {
    // spy = sinon.spy(needle, 'get');
    keys_stub = sinon.stub(keys, 'get').callsFake(() => {
      return {device: prey_cfg.device_key, api: prey_cfg.api_key}
    });
    status_stub = sinon.stub(status, 'get_status').callsFake((cb) => {
      return cb(null, {});
    });

    spy_status = sinon.spy(websocket, 'notify_status');
    // status_notif_stub = sinon.stub(websocket, 'notify_status').callsFake((data) => {
    //   return;
    // });
    // server_stub = sinon.stub(server, 'create_server').callsFake(() => {
    //   return;
    // });
  });

  after(function() {
    // spy.resetHistory();
    keys_stub.restore();
    status_stub.restore();
    spy_status.restore();
    // status_notif_stub.restore();
    // server_stub.restore();
  });

  describe('on load', function() {
    it('passes emitter to callback', function(done) {
      load(function(err, em, spy) {
        (em instanceof EventEmitter).should.equal(true);
        unload(done);
      });
    });
  });

  describe('on connection established', () => {

    it('notifies status', (done) => {
      server_up();

      load(function(err, em, spy) {
        setTimeout(() => {
          console.log("OEEEE!!", spy_status.callCount)
          spy_status.calledOnce.should.be.equal(true);
          setTimeout(() => {
            unload(() => {
              console.log("OEEEE!!", spy_status.callCount)
              server_down(done)
            });
          }, 1000);
        }, 2000);
      });

    });

    describe('ping pong', () => {

      before(() => {
        spy_heartbeat = sinon.spy(websocket, 'heartbeat');
        spy_socket_up = sinon.spy(websocket, 'startWebsocket');
      })

      after(() => {
        spy_heartbeat.restore();
        spy_socket_up.restore();
      })
      
        
      it('has a heartbeat on ping', (done) => {
        server_up();
        load((err, em, spy) => {
          setTimeout(() => {
            unload(() => {
              server_down(() => {
                spy_heartbeat.calledThrice.should.be.equal(true);
                done();
              })
            });
          }, 2500);
        });
      })
      
      it('restart conection when is not pinged', function(done) {
        this.timeout(13000);

        websocket.pingtime = 1500;
        server_up();
        load((err, em, spy) => {
          setTimeout(() => {
            test_server.stop_ping();
            setTimeout(() => {
              test_server.start_ping();
              setTimeout(() => {
                spy_socket_up.calledTwice.should.be.equal(true);
                unload(() => {
                  server_down(done)
                });
              }, 8000);
            }, 2000);
          }, 2000)
        });
      })
    })
  

    describe('when server notifies an action', () => {
      before((done) => {
        spy_perform = sinon.spy(commands, 'perform');
        actions_start_stub = sinon.stub(actions, 'start').callsFake(() => { return true; });

        server_up();
        commands.start_watching()
        storage2.init('commands', tmpdir() + '/ws.db', () => {
          load((err, em, spy) => { done(); })
        })

      })

      after((done) => {
        spy_perform.restore();
        actions_start_stub.restore();
        
        unload(() => {
          server_down(() => {
            storage2.erase(tmpdir() + '/ws.db', (done))
          });
        });
      });

      it('executes the action and store it', (done) => {
        setTimeout(() => {
          var action = [{"id": '1234', "type":"action", "time": Date.now(), "body":{"target": "alert", "command": "start", "options":{"message":"hi!"}}}]
          test_server.publish_action(action);
          setTimeout(() => {
            storage2.all('commands',(err, data) => {
              console.log("ALL", err, data)
              should.not.exist(err);
              data.length.should.be.equal(1);
              data[0].id.should.be.equal('1234');
              data[0].started_resp.should.be.equal(0);
            })
            spy_perform.calledOnce.should.be.equal(true);
              done();
          }, 2000);
        }, 1000);
      });

      describe('when has to send a response', () => {
        describe('on action started', () => {
          it('queue the response', (done) => {
            websocket.notify_action('started', '1234', 'alert', {"message":"hi!"})
            websocket.responses_queue.length.should.be.equal(1);
            websocket.responses_queue[0].reply_id.should.be.equal('1234');
            done();
          })

          it('unqueue the reponse after is received by the server and update the storage command', (done) => {
            setTimeout(() => {
              storage2.all('commands', (err, data) => {
                should.not.exist(err);
                data.length.should.be.equal(1);
                data[0].id.should.be.equal('1234');
                data[0].started_resp.should.be.equal(1);
              })
              websocket.responses_queue.length.should.be.equal(0);
              done();
            }, 2000)
          })
        })

        describe('on action stopped', () => {
          it('queue the response', (done) => {
            websocket.notify_action('stopped', '1234', 'alert', {"message":"hi!"})
            websocket.responses_queue.length.should.be.equal(1);
            websocket.responses_queue[0].reply_id.should.be.equal('1234');
            done();
          })

          it('unqueue the reponse after is received by the server and update the storage command', (done) => {
            setTimeout(() => {
              storage2.all('commands', (err, data) => {
                should.not.exist(err);
                data.length.should.be.equal(1);
                data[0].id.should.be.equal('1234');
                data[0].stopped_resp.should.be.equal(1);
              })
              websocket.responses_queue.length.should.be.equal(0);
              done();
            }, 2000)
          })
        });

        describe('and the server is not responding', () => {
          before((done) => {
            websocket.pingtime = 1500;
            websocket.re_schedule = true;
            server_down(done);
          })

          it('queue the response', (done) => {
            storage2.set('commands', '12345', {command: 'start', target: 'alert', options: {message: 'bye!'}}, () => {
              websocket.notify_action('started', '12345', 'alert', {message: 'bye!'})
              websocket.responses_queue.length.should.be.equal(1);
              websocket.responses_queue[0].reply_id.should.be.equal('12345');
              done();
            })
          })

          it('retries after the connection its achieved again', function(done) {
            this.timeout(15000);
            setTimeout(() => {
              server_up();

              setTimeout(() => {
                storage2.query('commands', 'id', '12345', (err, data) => {
                  should.not.exist(err);
                  data.length.should.be.equal(1);
                  data[0].id.should.be.equal('12345');
                  data[0].started_resp.should.be.equal(1);
                  websocket.responses_queue.length.should.be.equal(0);
                });
                done();
              }, 8000)

            }, 3000)
            
          })

        })

      })

      describe('and its an invalid object', () => {
        // CEHQUEAR EL TRY
        it('propagate error', (done) => {

          setTimeout(() => {
            var action = `[{"id": '1234', "type":"action", "time": Date.now(), "body":{"target": "alert", "command": "start", "options":{"message":"hi!"}}]`;


            test_server.publish_action(action);
            setTimeout(() => {
              done();
            }, 1000)
          }, 3000)
          

        });
      })

    });

  });

  // TESTEAR RESPONSES!! REINTENTOS,ETC



  // describe('when agent is connected to the Internet', function() {

  //   describe('and response has status code != 200', function() {

  //     it('triggers error and re-schedules', function(done) {
  //       var responses = 0;

  //       server_up(function(req, res) {
  //         if (responses > 2) return server_down();
  //         res.statusCode = 302;
  //         res.end();
  //         responses++;
  //       });

  //       load(function(err, em, spy) {
  //         getter_spy = spy;
  //         hooks.trigger('connected');
  //         hooks.on('error', listener);

  //         var errors = {};

  //         function listener(err) {
  //           if (spy.callCount < 3) {
  //             errors[err] ? errors[err].count++ : errors[err] = {count: 1};
  //           } else {
  //             finish();
  //           }
  //         }

  //         function finish() {
  //           spy.callCount.should.equal(3);
  //           errors.should.eql({ 'Error: Invalid response received with status code 302': { count: 2 } });
  //           errors.should.exist;
  //           unload(function() {
  //             server_down(function() {
  //               hooks.remove('error', listener);
  //               setTimeout(() =>{
  //                 done();
  //               }, 2000)
  //             });
  //           });
  //         }
  //       });
  //     });
  //   });

  //   describe('and response status code is 200', function() {

  //     describe('and valid command object', function() {

  //       it('emmits command', function(done) {
  //         var command = [{"command":"get","target":"location"}]
  //         var responses = 0;

  //         server_up(function(req, res) {
  //           if (responses) return server_down();
  //           res.statusCode = 200;
  //           res.write(JSON.stringify(command))
  //           res.end();
  //           responses++;
  //         });

  //         load(function(err, em, spy) {
            
  //           getter_spy = spy;
  //           hooks.trigger('connected');
  //           em.on('command', function(cmd) {
  //             responses++;
  //             JSON.stringify(cmd).should.eql(JSON.stringify(command[0]));
  //             finish();
  //           });

  //           function finish() {
  //             server_down(function() {
  //               unload(function() {
  //                 done();
  //               });
  //             });
  //           }
  //         });
  //       });
  //     });

  //     describe('and invalid command object', function() {

  //       it('triggers error', function(done) {
  //         var command = {"command":"get","target":"location"},
  //             responses = 0;

  //         server_up(function(req, res) {
  //           if (responses > 2) return server_down();
  //           res.statusCode = 200;
  //           res.write(command.toString());
  //           res.end();
  //           responses++;
  //         });

  //         load(function(err, em, spy) {
  //           getter_spy = spy;
  //           hooks.trigger('connected');
  //           hooks.on('error', listener);

  //           var errors = {};

  //           function listener(err) {
  //             if (spy.callCount < 3) {
  //               errors[err] ? errors[err].count++ : errors[err] = {count: 1};
  //             } else {
  //               finish();
  //             }
  //           }
  //           function finish() {
  //             server_down(function() {
  //               unload(function() {
  //                 hooks.remove('error', listener);
  //                 spy.callCount.should.equal(3);
  //                 errors.should.eql({ 'Error: Invalid command object': { count: 2 } });
  //                 done();
  //               });
  //             });
  //           }
  //         });
  //       });
  //     });
  //   });
  // });


  // describe('on unload', function() {
  //     it('returns true to cb', function(done) {
  //       long_polling.load.call(common_obj, function() {
  //         unload(function(unloaded) {
  //           unloaded.should.be.true;
  //           done();
  //         });
  //       });
  //     });
  // });

});