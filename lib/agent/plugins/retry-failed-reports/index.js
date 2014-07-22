var pending = [];

function store(err, resp, data) {
  if (err.code == 'EADDRINFO' || err.code == 'ENOTFOUND')
    pending.push(data);
}

function resend() {
  pending.forEach(function(data) {
    agent.hooks.trigger('report', data);
  })

  pending = [];
}

exports.load = function(agent, cb) {
  agent.hooks.on('response',store)
  agent.hooks.on('connected', resend)
}

exports.unload = function(cb) {
  agent.hooks.remove('reponse', store);
  agent.hooks.remove('disconnected', resend)
}
