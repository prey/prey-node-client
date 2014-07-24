var agent,
    failed = [],
    delay  = 20 * 1000; // wait 20 seconds before requeing each one

function store(err, resp, data) {
  if (err && (err.code == 'EADDRINFO' || err.code == 'ENOTFOUND'))
    failed.push(data);
}

function resend() {

  function emit() {
    var report = failed.shift();
    if (!report) return;

    agent.hooks.trigger('report', data);
    queue();
  }

  function queue() {
    setTimeout(emit, delay);
  }

  queue();
}

exports.load = function() {
  agent = this;
  agent.hooks.on('response', store);
  agent.hooks.on('connected', resend);
}

exports.unload = function() {
  agent.hooks.remove('reponse', store);
  agent.hooks.remove('disconnected', resend);
}
