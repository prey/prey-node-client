
var

  join              = require('path').join,
  sandbox           = require('sandboxed-module'),

  agent_index_path  = join(__dirname, '..','..','..', 'lib', 'agent', 'index.js'),

  is_windows        = process.platform === 'win32';



describe('lib/agent/index #wip', function(){

  var sandboxed_agent = {},
      requires        = {};

  before(function(done){
    var common = {
      logger      : {
        critical  : function(str) { var out = str; },
        debug     : function(str) { var out = str; },
        info      : function(str) { var out = str; },
        warn      : function(str) { var out = str; },
        write     : function(str) { var out = str; }
      }
    }
    requires = {
      './common' : common
    };
    done();
  });

  describe('run()', function(){

    describe('when run on interval', function(){

      if(is_windows){
      describe('and os is windows', function(){

        it('should not wait');
      });
      } // end `is_windows` condition

      describe('and os is NOT windows', function(){

        it('should wait a random number of seconds');
      });
    });
    describe('when run not on an interval', function(){
      it('should not wait');
    });
    describe('after timeout', function(){
      it('should not call initialize() after timeout');    
    });
  });
  describe('initialize()', function(){
    it('should write header');
    describe('when command was passed as argument', function(){
      it('should run command');
      it('should stop further execution (don\'t callback)');
    });
    describe('when skip-connection flag was passed', function(){
      it('should not check_connection()');    
      it('should callback');  
    });
    describe('when no skip-connection flag was passed', function(){
      it('should check status of connection');
      describe('if no connection is available', function(){
        it('should not check for updates');
        it('should callback(false)')
      });
      describe('if connection is available', function(){
        describe('and can_update() returns false', function(){
          it('should not check for updates');
          it('should callback(true)');
        });
        describe('and can_update() returns true', function(){
          it('should check for updates');
        });
      });
    });
    describe('when checking for updates', function(){
      describe('if no version was found', function(){
        it('should callback true');
      });
      describe('if new version was installed', function(){
        it('does not callback');
        it('triggers a `new version` event');
        it('calls agent.shutdown()');
      });
    });
  });
});
