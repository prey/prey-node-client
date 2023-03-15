var helpers       = require('../../../helpers'),
    should        = require('should'),
    sinon         = require('sinon'),
    fs            = require('fs'),
    join          = require('path').join,
    tmpdir        = require('os').tmpdir,
    common        = require('../../../../lib/common'),
    module_path   = helpers.lib_path('conf', 'tasks', 'clear_files_prey_temp'),
    clear_files_prey_temp = require(module_path);

describe('Remove files prey-config', () => {

    describe('When dont have access to temp folder', () => {

        before((done) => {
            status_stub = sinon.stub(clear_files_prey_temp, 'start').callsFake((cb) => {
                return cb(new Error('EACCES: permission denied'))
            });
            done()
        });

        after(function () {
            status_stub.restore();
        })

        it('Should return error ', (done) => {
            clear_files_prey_temp.start((err) => {
                should.exist(err);
                err.message.should.containEql('permission denied');
                done();
            });
        });
    })

    describe('When files to delete is zero', () => {

        let dir_path = join(tmpdir(), 'temp1');

        before((done) => {
            fs.mkdir(dir_path, function () {
                    common.system.paths.temp = dir_path;
                    done()
            });
        })

        it('Should return not files to delete', (done) => {
            clear_files_prey_temp.start((err) => {
                should.not.exist(err);
                done();
            });
        });
    })

    describe('Return ok', () => {

        let dir_path = join(tmpdir(), 'temp2');

        before((done) => {
            fs.mkdir(dir_path, function () {
                fs.writeFile(join(dir_path,'prey-config-abc1.log'), 'log', function (err) {
                    fs.writeFile(join(dir_path,'prey-config-abc2.log'), 'log', function (err) {
                        fs.writeFile(join(dir_path,'prey-config-abc3.log'), 'log', function (err) {
                            fs.writeFile(join(dir_path,'dontdelete.log'), 'log', function (err) {
                                common.system.paths.temp = dir_path;
                                    done()
                            });
                        });
                    });
                  });
                                
            });
        })

        it('Should remove prey-conf', (done) => {
            clear_files_prey_temp.start((err, obj) => {
                should.not.exist(err);
                done();
            });
        });
    })

})


