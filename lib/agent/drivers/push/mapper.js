var pmp       = require('nat-pmp'),
    upnp      = require('entry'),
    exec      = require('child_process').exec;

var max_attempts = 3,
    mapper,
    mapped_opts,
    pmp_client, 
    gateway_ip, 
    debugging = true; // !!process.env.DEBUG;

var get_gateway_ip = function(cb) {

  exec("traceroute -m1 -n 8.8.8.8 | awk '{print $2}'", function(err, ip) {
    if (err || ip == '') return cb(err);
    gateway_ip = ip.trim();
    cb(null, gateway_ip);
  });

}

var debug = function(str, info) {
  if (!debugging) return;
  return info ? console.log(str, info) : console.log(str);
}

//////////////////////////////////////////////////////////////////////
// client specific mappings
//////////////////////////////////////////////////////////////////////

// opts => { private: 22, public: 2222, ttl: 3600 }
var map_pmp = function(opts, cb) {
  debug('===> NAT-PMP external ' + opts.external + ' to internal ' + opts.internal);

  var client, returned = false;

  var args = {
    public : opts.external,
    private: opts.internal
  }
  
  var done = function(err, info) {
    if (returned) return;
    cb(err, info);
    returned = true;
    client.close();
  }
  
  get_gateway_ip(function(err, ip) {
    if (err) return cb(err);

    debug('Got gateway IP: ' + ip);
    client = pmp.connect(ip);

    try {
      client.portMapping(args, done);
    } catch(e) {
      cb(e);
    }

    setTimeout(function() {
      done(new Error('Timed out.'))
    }, 10000);

  })
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
    return cb(new Error('Not mapped'));

  if (mapper == upnp)
    mapper.unmap(mapped_opts, cb);
  else
    mapper.unmap(mapped_opts.external, cb);
}

var try_map = function(attempt, opts, cb) {
  if (mapper) 
    return cb(new Error('Already mapped!'));

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

exports.map = function(opts, cb) {
  if (!opts.starting) throw new Error('Starting port required!');
  opts.external = opts.starting;
  try_map(1, opts, cb);
}

exports.unmap = function(cb) {
  do_unmap(cb);
}