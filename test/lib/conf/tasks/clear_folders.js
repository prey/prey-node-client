var helpers       = require('./../../../helpers'),
    should        = require('should'),
    sinon         = require('sinon'),
    fs            = require('fs'),
    join          = require('path').join,
    tmpdir        = require('os').tmpdir,
    common        = require('../../../../lib/common'),
    module_path   = helpers.lib_path('conf', 'tasks', 'clear_folders'),
    clear_folders = require(module_path);

describe('Remove old folders version', () => {

    describe('When dont have access to folder', () => {

        before((done) => {
            status_stub = sinon.stub(clear_folders, 'start').callsFake((cb) => {
                return cb(new Error('EACCES: permission denied'))
            });
            done()
        });

        after(function () {
            status_stub.restore();
        })

        it('Should return error ', (done) => {
            clear_folders.start((err, obj) => {
                should.exist(err);
                err.message.should.containEql('permission denied');
                done();
            });
        });
    })

    describe('When folders to delete is zero', () => {

        let dir_path = join(tmpdir(), 'versions1'),
            path4 = join(dir_path, '1.10.11');

        before((done) => {
            fs.mkdir(dir_path, function () {
                fs.mkdir(path4, function () {
                    common.system.paths.versions = dir_path;
                    common.version = "1.10.11";
                    done()
                });
            });
        })

        it('Should remove old folders', (done) => {
            clear_folders.start((err, obj) => {
                should.exist(err);
                err.message.should.containEql('Not folders to delete');
                done();
            });
        });
    })

    describe('When length folders to delete is zero', () => {

        let dir_path = join(tmpdir(), 'versions1'),
            path4 = join(dir_path, '1.10.11');

        before((done) => {
            fs.mkdir(dir_path, function () {
                fs.mkdir(path4, function () {
                    common.system.paths.versions = dir_path;
                    common.version = "1.10.11";
                    done()
                });
            });
        })

        it('Should remove old folders', (done) => {
            clear_folders.start((err, obj) => {
                should.exist(err);
                err.message.should.containEql('Not folders to delete');
                done();
            });
        });
    })

    describe('Return ok', () => {

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

        it('Should remove old folders', (done) => {
            clear_folders.start((err, obj) => {
                should.not.exist(err);
                done();
            });
        });

        it('Should exist folder with current version', (done) => {
            const folder_exist = fs.existsSync(join(dir_path, common.version))
            folder_exist.should.equal(true);
            done();
        });
    })

})


