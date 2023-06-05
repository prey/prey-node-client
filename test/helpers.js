var needle = require('needle'),
    sinon = require('sinon'),
    path = require('path'),
    root_path = path.resolve(__dirname, '..'),
    lib_path = path.join(root_path, 'lib'),
    spawn = require('child_process').spawn,
    Emitter = require('events').EventEmitter,
    providers = require(path.join(lib_path, 'agent','providers')), 
    helpers = {};

var prey_bin  = path.join(root_path, 'bin', 'prey');

if (process.platform == 'win32')
  prey_bin = prey_bin + '.cmd';

console.log(' == NODE VERSION: ' + process.version);
process.env.TESTING = 'true';

helpers.root_path = root_path;

helpers.load = function(module_name){
  return require('./../lib/agent/' + module_name);
}

helpers.lib_path = function() {
  if (!arguments[0]) return lib_path;

  var arr = [lib_path];
  for (var i = 0; i < arguments.length; i++) {
    arr.push(arguments[i]);
  }

  return path.join.apply(this, arr);
}

helpers.run_cli = function(args, cb) {
  var out = '', err = '', child = spawn(prey_bin, args);
  child.stdout.on('data', function(data) { out += data });
  child.stderr.on('data', function(data) { err += data });
  child.on('exit', function(code) { cb(code, out, err) });
};

helpers.fake_spawn_child = function() {
  var child = new Emitter();
  child.stdout = new Emitter();
  child.stderr = new Emitter();
  child.unref = function() {}
  return child;
}

/*
  this helper lets you fake requests using needle:
  helpers.stub_request(method, err, resp, body);

  examples:
  helpers.stub_request('get', null, { statusCode: 200 }, 'OK' );
  helpers.stub_request('post', null, { statusCode: 401 }, 'Unauthorized' );
  helpers.stub_request('put', new Error('ENOENT'))

  then, when needle.(get|post|put) is called, it will return those (err, resp, body)
  and restore the original method.

*/

// TODO @lemavri DRY stub creation

helpers.stub_request = function(type, err, resp, body, callback) {
  var args2,
      cb,
      stub = sinon.stub(needle, type).callsFake((...args) => {
        cb = helpers.callback_from_args(args);
        args2 = args[2];
        if (callback) callback(args2);
        cb(err, resp, body);
        stub.restore();
      });

  return stub;

}

helpers.stub_provider = function(name, err, return_value) {
  var cb,
      stub = sinon.stub(providers, 'get').callsFake((...args) => {
        cb = helpers.callback_from_args(args);
        cb(err, return_value);
      });

  return stub;
};

helpers.callback_from_args = function(args) {
  var cb;

  for (var i = 0, len = args.length; i < len; i++) {
    if (typeof args[i] === 'function') {
      cb = args[i]
    }
  }

  return cb;
}

module.exports = helpers;
