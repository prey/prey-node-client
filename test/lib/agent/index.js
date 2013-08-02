var fs                = require('fs'),
    join              = require('path').join;

describe('lib/agent/index', function(){

  describe('todo', function(){

    describe('when `-r` (program.run) is set', function(){
      it('should perform the command given as argument');
    });

  });

  describe('engage()', function(){

    it('should trigger `woken` hook with the param given');

  });

  describe('shutdown()', function(){

    describe('when there are loaded drivers', function(){

      it('should unload drivers');

    });

    describe('when there are loaded hooks', function(){

      it('should unload hooks');

     });

    describe('other shutdown operations', function(){

      it('should cancel reports');

      it('should unwatch triggers');

      it('should clean up files');

      it('should set `running` as false');

    });

  });

});
