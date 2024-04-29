const join = require('path').join;
const paths = require(join('..', '..', '..', 'system', 'paths'));

exports.post_install = function(cb) {
  cb();
};

exports.pre_uninstall = function(cb) {
  cb();
};

exports.post_activate = function(cb) {
  cb();
};

exports.deleteOsquery = (cb) => {
  exec(`${paths.install}/bin/trinity --uninstall`, () => {
    if (cb && typeof cb !== 'undefined') cb();
  });
};