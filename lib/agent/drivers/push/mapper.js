var pmp       = require('nat-pmp'),
    upnp      = require('entry'),
    providers = require('./../../providers');

var max_attempts = 5,
    mapper,
    mapped_opts;

//////////////////////////////////////////////////////////////////////
// client specific mappings
//////////////////////////////////////////////////////////////////////

// opts => { private: 22, public: 2222, ttl: 3600 }
var map_pmp = function(opts, cb) {

  var args = {
    public : opts.external,
    private: opts.internal
  }

  providers.get('gateway_ip', function(err, ip) {
    if (err) return cb(err);

    console.log('Got gateway IP: ' + ip);
    return cb(new Error('Skipping PMP mapping.'));

    var client = pmp.connect(ip);
    try {
      client.portMapping(args, cb);
    } catch(e) {
      cb(e);
    }
  })
}

// opts = > { internal: 22, external: 22, name: 'foo' }
var map_upnp = function(opts, cb) {
  console.log(opts);
  upnp.map(opts, cb);
}

//////////////////////////////////////////////////////////////////////
// main functions
//////////////////////////////////////////////////////////////////////

var do_map = function(opts, cb) {

  var done = function(module, err, info) {
    if (!err) {
      console.log('Mapped!', opts);
      mapper = module;
      mapped_opts = opts;
    }
    cb(err, info);
  }

  console.log('Trying via PMP.');
  map_pmp(opts, function(err, info) {
    if (!err) return done(pmp, null, info);

    console.log('No workie. Trying via UPNP.');
    map_upnp(opts, function(err, info) {
      done(upnp, err, info);
    })
  })
}

var do_unmap = function(cb) {
  if (!mapper) return cb(new Error('Not mapped'));

  if (mapper == upnp)
    mapper.unmap(mapped_opts, cb);
  else
    mapper.unmap(mapped_opts.external, cb);
}

var try_map = function(attempt, opts, cb) {
  if (mapper) return cb(new Error('Already mapped!'));

  var retry = function() {
    opts.external = opts.external + 1;
    // opts.internal = opts.internal + 1;
    try_map(attempt +  1, opts, cb);
  }

  do_map(opts, function(err) {
    if (!err || attempt >= max_attempts)
      return cb(err);
    else // had error but we can still try once more
      retry();
  })
}

//////////////////////////////////////////////////////////////////////
// exports
//////////////////////////////////////////////////////////////////////

exports.map = function(opts, cb) {
  try_map(1, opts, cb);
}

exports.unmap = function(cb) {
  do_unmap(cb);
}

/*

var opts = {
  internal : 3333,
  external : 3333,
  name     : 'Foobar'
}

exports.map(opts, function(err, info) {
  console.log(err || info);
  exports.unmap(function(err) {
    console.log(err);
  })
});

*/
