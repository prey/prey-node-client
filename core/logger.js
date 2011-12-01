// from https://github.com/DelvarWorld/Simple-Node-Logger.git

var sys    = require('sys'),
    logLevels = ['silent', 'error', 'warn', 'info', 'debug'],
    logger = module.exports,
    // Shell color escape codes
    escr ="",
    reset = escr+'[0m',
    // Color array matches logLevels array, starting from 'error'
    colors = [escr+'[31m', escr+'[33m', escr+'[34m'];

// ECMAScript getter and setter syntax
logger.__defineGetter__('log_level', function(){
    return logLevels[this.selfLogLevel];
});

logger.__defineSetter__('log_level', function(arg){
    this.selfLogLevel = logLevels.indexOf(arg);
    var em = function() {};

    // Create a funciton for each level except silent
    for(var x=1, l=logLevels.length; x<l; x++) {
        this[logLevels[x]] = this.selfLogLevel >= x ? function(y){return function() {
            var args = Array.prototype.slice.call(arguments), l = args.length;
            while(l--) {
                if(args[l] && typeof args[l] == 'object' && args[l].toString() == '[object Object]') {
                    args[l] = sys.inspect(args[l]);
                }
            }
            sys.log.call(this, (this.color ? (colors[y-1] || '') + logLevels[y].toUpperCase() + reset :
            logLevels[y].toUpperCase())+': '+args.join(' '));
        };}(x) : em;
    }
});

// Default to colorful warn
logger.log_level = 'warn';
logger.color = true;
