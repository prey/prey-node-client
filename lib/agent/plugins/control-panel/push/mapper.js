var pmp       = require('nat-pmp'),
    upnp      = require('entry'),
    network   = require('network'),
    exec      = require('child_process').exec;

var max_attempts = 3,
    mapper,
    mapped_opts,
    gateway_ip,
    debugging = !!process.env.DEBUG;

var debug = function(str, info) {
  if (!debugging) return;
  return info ? console.log(str, info) : console.log(str);
}

//////////////////////////////////////////////////////////////////////
// client specific mappings
//////////////////////////////////////////////////////////////////////

var get_pmp_client = function(cb) {
  var done = function(err, ip) {
    if (err) return cb(err);

    // if this is the response to the get_gateway_ip call, store the ip
    if (ip) gateway_ip = ip;
    cb(null, new pmp.Client(gateway_ip));
  }

  if (gateway_ip)
    return done();
  else
    network.get_gateway_ip(done);
}

var call_pmp = function(method, opts, cb) {
  var timer, this_client, returned = false;

  var done = function(err, info) {
    if (timer) clearTimeout(timer);
    if (returned) return;

    cb(err, info);
    returned = true;

    this_client.close();
    this_client.removeListener('error', done);
  }

  get_pmp_client(function(err, client) {
    if (err) return cb(err);

    this_client = client;
    client.on('error', done);

    try {
      client[method](opts, done);
    } catch(e) {
      done(e);
    }

    timer = setTimeout(function() {
      done(new Error('Timed out trying to connect to router.'))
    }, 5000);
  });
}

// opts => { private: 22, public: 2222, ttl: 3600 }
var map_pmp = function(opts, cb) {
  debug('===> NAT-PMP external ' + opts.external + ' to internal ' + opts.internal);

  var args = {
    public : opts.external,
    private: opts.internal
  }

  call_pmp('portMapping', args, cb)
}

var unmap_pmp = function(opts, cb) {
  call_pmp('portUnmapping', opts, cb);
}

// opts = > { internal: 22, external: 22, name: 'foo' }
var map_upnp = function(opts, cb) {
  debug('===> UPNP external ' + opts.external + ' to internal ' + opts.internal);
  upnp.map(opts, cb);
}

//////////////////////////////////////////////////////////////////////
// main functions
//////////////////////////////////////////////////////////////////////

var do_map = function(opts, cb) {

  var done = function(module, err, info) {
    if (!err) {
      debug('Mapped!', opts);
      mapper = module;
      mapped_opts = opts;
    }
    cb(err, info);
  }

  map_pmp(opts, function(err, info) {
    if (!err) return done(pmp, null, info);

    debug('NAT-PMP Mapping failed: ' + err.message);
    map_upnp(opts, function(err, info) {
      if (err)
        debug('UPNP Mapping failed: ' + err.message);

      done(upnp, err, info);
    })
  })
}

var do_unmap = function(cb) {
  if (!mapper)
    return cb && cb(new Error('Not mapped.'));

  var finished = false;

  // even if unmapping fails, we'll clear the mapped opts
  // object in order to ensure that when calling map() again
  // we won't return an error. if unmap fails it's probably
  // because the computer is changing to a new Wi-Fi network,
  // so the most probable scenario is that we should map() again.
  var done = function(err, info) {
    if (finished) return;
    finished = true;

    mapped_opts = null;
    cb && cb(err, info);
  }

  if (mapper == upnp) {
    mapper.unmap(mapped_opts, done);
  } else {
    unmap_pmp(mapped_opts, done);
  }
}

var try_map = function(attempt, opts, cb) {
  // TODO: we should probably check here whether
  // the existing port mapping is still valid.
  if (mapped_opts) {
    return cb(new Error('Already mapped! Port: ' + mapped_opts.external))
  }

  var retry = function() {
    opts.external = opts.external + 1;
    // opts.internal = opts.internal + 1;
    try_map(attempt +  1, opts, cb);
  }

  do_map(opts, function(err) {
    if (!err || attempt >= max_attempts)
      return cb(err, opts.external);

    // had error but we can still try once more
    debug('Retring in 3 seconds...');
    setTimeout(retry, 3000);
  })
}

//////////////////////////////////////////////////////////////////////
// exports
//////////////////////////////////////////////////////////////////////

exports.public_ip = function(cb) {
  if (!mapper)
    return cb(new Error('Not mapped!'));

  if (mapper != upnp)
    return network.get_public_ip(cb);

  // try with mapper. fallback to network module if it fails.
  mapper.public_ip(function(err, ip) {
    if (ip) return cb(null, ip);

    network.get_public_ip(cb);
  })
}

exports.map = function(opts, cb) {
  if (!opts.starting)
    return cb(new Error('Starting port required!'));

  opts.external = opts.starting;
  try_map(1, opts, cb);
}

// this may be called without a callback, as a rollback
// method when push is stopped while we're still mapping.
exports.unmap = function(cb) {
  do_unmap(cb);
}

exports.found_upnp_mapping = function(opts) {
  mapper = upnp;
  mapped_opts = opts;
}
