var fs      = require('fs'),
    should  = require('should');

describe('all actions', function(){

  var actions_path = __dirname + '/../../../lib/agent/actions/';
  var actions = fs.readdirSync(actions_path);

  describe('exports', function(){

    it('has a start() function', function(){

      actions.forEach(function(action_name){

        var mod = require(actions_path + action_name);
        (typeof mod.start).should.equal('function');

      });

    });

  });

});
