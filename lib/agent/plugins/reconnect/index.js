var system;

function reconnect() {
  system.reconnect();
}

exports.load = function(agent, cb) {
  system = agent.system;
  agent.hooks.on('disconnected', reconnect)
}

exports.unload = function(cb) {
  agent.hooks.remove('disconnected', reconnect)
}
