var helpers = require('./helpers'),
    should  = helpers.should,
    finder  = require(__dirname + '/../lib/utils/finder');

/*describe('each platform', function(){

  it('exports the same number of function on each module', function(done){

    var load = function(dir, os){
      var p = __dirname + '/../' + dir + '/' + os;
      return require(p);
    }

    var checkPath = function(dir){

      var linux = load(dir, 'linux'),
          mac =   load(dir, 'mac'),
          windows = load(dir, 'windows');

      // Object.keys(mac).length.should.equal(Object.keys(windows).length);
      // linux.should.have.keys(Object.keys(mac));
      // windows.should.have.keys(Object.keys(linux));
    }

    finder.eachFileOrDirectoryMatching(/linux(\.js)?$/, './lib', function(err, match, stat){

      if (match.indexOf('lock/linux') == -1)
        checkPath(helpers.path.dirname(match));

    }, function(){
      done();
    });

  })

})*/
