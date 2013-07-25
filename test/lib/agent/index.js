
var fs                = require('fs'),
    join              = require('path').join,
    sandbox           = require('sandboxed-module'),
    utils             = require(join(__dirname,'..', '..', 'utils', 'test_utils.js')),
    agent_index_path  = join(__dirname, '..', '..', '..', 'lib', 'agent', 'index.js'),
    is_windows        = process.platform === 'win32';

describe('lib/agent/index', function(){

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

  describe('shutdown()', function(){

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

      var index, spy_hooks_unload_called;

      before(function(){
        var common = utils.create_common_object();
        common.program.run = false;
        var hooks   = {
          unload : function() {
            spy_hooks_unload_called = true;
            return;
          }
        }
        var updater = {
          check : function(cb){ return cb(null, false); }
        }
        var requires = {
          './common'    : common,
          './hooks'     : hooks,
          './updater'   : updater,
        };

        index = sandbox.require(agent_index_path, { requires : requires });
      });

      it('should unload hooks', function(done){
        index.shutdown();
        spy_hooks_unload_called.should.be.equal(true);
        done();
      });
    });

    describe('other shutdown operations', function(){

      var index, spy_calls = {};

      before(function(){
        var common = utils.create_common_object();
        common.program.run = false;
        common.helpers = {
          remove_files : function() {
            spy_calls['common.helpers.remove_files'] = true;
            return;
          }
        }
        var hooks   = {
          unload : function() { return; }
        }
        var triggers = {
          unwatch : function() {
            spy_calls['triggers.unwatch'] = true;
            return;
          }
        }
        var reports = {
          cancel_all : function() {
            spy_calls['reports.cancel_all'] = true;
          }
        }
        var updater = {
          check : function(cb){ return cb(null, false); }
        }
        var requires = {
          './common'    : common,
          './hooks'     : hooks,
          './reports'   : reports,
          './triggers'  : triggers,
          './updater'   : updater,
        };

        index = sandbox.require(agent_index_path, { requires : requires });

        index.shutdown();
      });

      it('should cancel reports', function(){
        spy_calls.should.have.property('reports.cancel_all');
      });

      it('should unwatch triggers', function(){
        spy_calls.should.have.property('triggers.unwatch');
      });

      it('should clean up files', function(){
        spy_calls.should.have.property('common.helpers.remove_files');
      });

      it('should set `running` as false', function(){
        index.running().should.be.equal(false);
      });
    });
  });
});
