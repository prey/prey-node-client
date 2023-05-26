var fs      = require('fs'),
    join    = require('path').join,
    should  = require('should'),
    helpers = require('./../../helpers');

var plugins_path = helpers.lib_path('./agent/plugins');

// this simply tests that all installed plugins have all their dependencies and contain no syntax errors.

describe('plugins', function() {

  fs.readdirSync(plugins_path).forEach(function(dir) {

    it('loads ' + dir + ' plugin properly', function() {

      var mod = require(join(plugins_path, dir));
      Object.keys(mod).should.containEql('load');
      Object.keys(mod).should.containEql('unload');

    })

  })

})
