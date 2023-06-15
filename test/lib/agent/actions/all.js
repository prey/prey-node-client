var fs            = require('fs'),
    path          = require('path'),
    should        = require('should'),

    actions_path  = path.join(__dirname, '..', '..', '..', '..', 'lib', 'agent', 'actions'),
    actions       = fs.readdirSync(actions_path);

describe('all actions', function(){

  describe('exports', function(){

    it('has a start() function', function(){

      actions.forEach(function(action_name){

        if (action_name != '.DS_Store') {
          var mod = require(path.join(actions_path, action_name));
          (typeof mod.start).should.equal('function');     
        }
       
      });

    });

  });

});
