var fs      = require('fs'),
    should  = require('should');

describe('all providers', function(){

  var providers_path = __dirname + '/../../../lib/agent/providers/';
  var providers = fs.readdirSync(providers_path);

/*

  describe('get_* functions', function(){

    describe('when called', function(){

      it('does not throw', function(done){

        var err;

        providers.forEach(function(provider_name){

          var mod = require(providers_path + provider_name);

            Object.keys(mod).forEach(function(fn){

              if (fn.match(/^get_/)) {

                try {
                  mod[fn]();
                } catch(e) {
                  err = e;
                  if (e) throw(e);
                }

              }

            });

          });

          should.not.exist(err);

        done();

      });

    })

  });

*/

});
