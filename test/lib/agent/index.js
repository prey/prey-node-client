
var join              = require('path').join,
    sandbox           = require('sandboxed-module'),
    agent_index_path  = join(__dirname, '..', '..', '..', 'lib', 'agent', 'index.js'),
    common_path       = join(__dirname, '..', '..', '..', 'lib', 'agent', 'common.js'),
    is_windows        = process.platform === 'win32';

describe('lib/agent/index #wip', function(){

  describe('run()', function(){

    describe('when `-r` flag is set', function(){

      var index, hooks_called;

      before(function(){
        var common = require(common_path);
        common.program.run = true;
        common.logger = {
          prefix : function() { return {
              error : function() { return; },
              off   : function() { return; },
              write : function() { return; }
            }
          }
        }
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

    describe.skip('when checking for updates with `update.check()`', function(){

      var index;

      describe('and it finds a new version', function(){

        // This variable will store whether we have called
        // logger.warn()
        var flag_logger_warn_called = false;

        before(function(){
          var common = require(common_path);
          // Let's set this one explicitly!
          common.program.run = false;
          common.logger = {
            prefix : function() { return {
                error : function() { return; },
                off   : function() { return; },
                warn  : function() { flag_logger_warn_called = true; return; },
                write : function() { return; }
              }
            }
          }
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
          flag_logger_warn_called.should.be.equal(true);
          done();
        });
      });

      describe('and does NOT find a new version', function(){

        it('should call `boot()`')
      })
    });
  });
});
