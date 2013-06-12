
var fs                = require('fs'),
    join              = require('path').join,
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
          var loader  = {
            load_driver : function(){
              var _cb = arguments[1];
              return _cb(new Error('End Test'));
            }
          }
          var requires = {
            './common'    : common,
            './updater'   : updater,
            './hooks'     : hooks,
            './loader'    : loader
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

  describe('engage()', function(){

    var index, hooks_triggered;

    before(function(){
      var common = utils.create_common_object();
      hooks_triggered = [];
      var hooks = {
        trigger : function(hook, type) {
          var obj = {};
          obj[hook] = type;
          hooks_triggered.push(obj);
        }
      }
      var requires = {
        './common'    : common,
        './hooks'     : hooks
      };
      index = sandbox.require(agent_index_path, { requires : requires });
    });

    it('should trigger `woken` hook with the param given', function(done){
      index.engage('engage_type');
      hooks_triggered[0].should.have.property('woken');
      hooks_triggered[0]['woken'] = 'engage_type';
      done();
    });
  });

  describe('shutdown() #wip2', function(){

    describe('when there are loaded drivers', function(){

      var index, spy_unload_called = {};

      before(function(){
        var common = utils.create_common_object();
        common.program.run = false;
        var hooks   = {
          unload : function() { return; }
        }
        var updater = {
          check : function(cb){ return cb(null, false); }
        }
        var requires = {
          './common'    : common,
          './hooks'     : hooks,
          './updater'   : updater,
        };

        // We need drivers exposed in here...
        var agent_index_contents = require('fs').readFileSync(agent_index_path, 'utf8');
        agent_index_contents += '\nexports.drivers = drivers;'
        fs.renameSync(agent_index_path, agent_index_path + '.tmp');
        fs.writeFileSync(agent_index_path, agent_index_contents, { mode: 0755 });

        index = sandbox.require(agent_index_path, { requires : requires });

        // Then we force this up (remember `drivers` is private)
        index.drivers['test_driver_alpha'] = {
          unload : function() {
            spy_unload_called['alpha'] = true;
          }
        }
        index.drivers['test_driver_beta'] = {
          unload : function() {
            spy_unload_called['beta'] = true;
          }
        }
      });

      it('should unload drivers', function(done){
        index.shutdown();
        spy_unload_called.should.have.property('alpha');
        spy_unload_called.should.have.property('beta');
        done();
      });

      after(function(done){
        fs.unlinkSync(agent_index_path);
        fs.rename(agent_index_path + '.tmp', agent_index_path, done)
      });
    });

    describe('when there are loaded hooks', function(){
      it('should unload hooks');
    });
    
    it('should cancel reports');
    it('should unwatch triggers');
    it('should clean up files');
    it('should set `running` as false');
  });
});
