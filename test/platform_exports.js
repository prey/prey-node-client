
/*
var join = require('path').join;

describe('each platform', function(){

  it('exports the same number of functions on each module', function(done){

    var load = function(dir, os){
      return require(join(__dirname, '..', dir, os));
    }

    var checkPath = function(dir){

      var linux   = load(dir, 'linux'),
          mac     = load(dir, 'mac'),
          windows = load(dir, 'windows');

      console.log(Object.keys(linux));

      // Object.keys(mac).length.should.equal(Object.keys(windows).length);
      // linux.should.have.keys(Object.keys(mac));
      // windows.should.have.keys(Object.keys(linux));
    }
  });
});

*/

/*finder.eachFileOrDirectoryMatching(/linux(\.js)?$/, './lib', function(err, match, stat){

  if (match.indexOf('lock/linux') == -1)
    checkPath(helpers.path.dirname(match));

}, function(){
  done();
});*/
