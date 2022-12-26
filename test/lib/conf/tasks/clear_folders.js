var helpers        = require('./../../../helpers'),
    should         = require('should'),
    fs             = require('fs'),
    join           = require('path').join,
    tmpdir         = require('os').tmpdir,
    common         = require('../../../../lib/common'),
    module_path    = helpers.lib_path('conf', 'tasks', 'clear_folders'),
    clear_folders   = require(module_path);

describe('Remove old folders version', () => {


    let dir_path = join(tmpdir(), 'versions'),
    path = join(dir_path, '1.10.8'),
    path2 = join(dir_path, '1.10.9'),
    path3 = join(dir_path, '1.10.10'),
    path4 = join(dir_path, '1.10.11');

    before((done) => {
    fs.mkdir(dir_path, function () {
        fs.mkdir(path, function () {
            fs.mkdir(path2, function () {
                fs.mkdir(path3, function () {
                    fs.mkdir(path4, function () {
                    common.system.paths.versions = dir_path;
                    common.version = "1.10.11";
                    done()
                    });
                });
            });
        });
    });
    })

  describe('Return ok', () => {

    it('Should remove old folders', (done) => {
        clear_folders.start((err, obj) => {
        should.not.exist(err);
        done();
      });
    });
  })

})


