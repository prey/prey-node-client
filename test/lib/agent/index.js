
var join              = require('path').join,
    sandbox           = require('sandboxed-module'),
    utils             = require(join(__dirname,'..', '..', 'utils', 'test_utils.js')),
    agent_index_path  = join(__dirname, '..', '..', '..', 'lib', 'agent', 'index.js'),
    is_windows        = process.platform === 'win32';

describe('lib/agent/index #wip', function(){

  describe('run()', function(){

    describe('when `-r` flag is set', function(){

      var index, hooks_called;

      before(function(){
        var common = utils.create_common_object();
        common.program.run = true;
        var command = {
          parse : function(){ return [null, { command : null }]; }
        }
        hooks_called = [];
        var hooks = {
          on : function(hook) {
            hooks_called.push(hook);
          }
        }
        var requires = {
          './command'   : command,
          './common'    : common,
          './hooks'     : hooks
        };
        index = sandbox.require(agent_index_path, { requires : requires });
      });

      it('should perform the command given as argument', function(done){
        index.run();
        hooks_called.should.eql([ 'data', 'error', 'report' ]);
        done();
      });
    });

    describe('when checking for updates with `update.check()`', function(){

      var index, common;

      describe('and it finds a new version', function(){

        before(function(){
          common = utils.create_common_object();
          common.program.run = false;
          var updater = {
            check : function(cb){ return cb(null, true); }
          }
          var requires = {
            './common'  : common,
            './updater' : updater
          };
          index = sandbox.require(agent_index_path, { requires : requires });
        });

        it('should shutdown', function(done){
          index.run();
          common._spy.should.have.property('logger.warn');
          done();
        });
      });

      describe('and does NOT find a new version', function(){

        var index, hooks_called;

        before(function(){
          var common = utils.create_common_object();
          common.program.run = false;
          var updater = {
            check : function(cb){ return cb(null, false); }
          }
          hooks_called = [];
          var hooks = {
            on : function(hook) {
              hooks_called.push(hook);
            }
          }
          var requires = {
            './common'    : common,
            './updater'   : updater,
            './hooks'     : hooks
          };
          index = sandbox.require(agent_index_path, { requires : requires });
        });

        it('should call `boot()`', function(done){
          index.run();
          // We will be satisfied that `boot` was called if we find the
          // hooks called in `load_hooks()`. We will test the flow of `boot`
          // afterwards.
          hooks_called.should.eql([ 'action', 'event', 'data', 'report', 'response', 'error', 'file' ]);
          done();
        });
      })
    });
  });
});
