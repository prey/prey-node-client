"use strict";

//////////////////////////////////////////
// Prey Response Parser
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var common = _ns('common'),
logger = common.logger,
exec = require('child_process').exec,
xml2js = require('xml2js'),
crypto = require('crypto');

var ResponseParser = {

  log: function(str){
    logger.info('[parser] ' + str);
  },

  parse: function(data, options, callback){
    var self = this;
    // console.log(data);

    data = data.toString();
    // if we haven't tried to decrypt yet, and it seems encrypted
    if(!options.decrypted && data.indexOf('<html>') === -1 && data.indexOf('config') === -1){

      this.decrypt_response(data, options.api_key, function(output){
        options.decrypted = true;
        // console.log(output);
        self.parse(output, options, callback);
      });

    // check if its an xml
    } else if(data.indexOf('<config') !== -1){

      this.parse_xml(data, function(err, result){
        if(err)
          callback(err);
        else if(result.modules) // old XML
          self.build_new_schema(result, options, callback);
        else
          callback(null, result);
      });

    // look for application/js(on) or application/javascript
    } else {
      try {
        callback(null, JSON.parse(data));
      } catch(e){
        callback(new Error("Unkown data type received."));
      }
    }
  },

  // all the slice mumbo-jumbo is to provide full compatibility with
  // the command-line openssl command, used in the bash client.
  decrypt_response: function(data, key, callback){

    this.log("Got encrypted response. Decrypting...");
    var hashed_key = key.length === 32 ? key : crypto.createHash('md5').update(key).digest("hex");

    var buf = new Buffer(data, 'base64');
    var raw = buf.toString('binary');

    var pad = raw.slice(0, 8);
    var salt = raw.slice(8, 16);
    raw = raw.slice(16);

    var decipher = crypto.createDecipher('aes-128-cbc', hashed_key + salt);
    var dec = decipher.update(raw, 'binary', 'utf8');
    dec += decipher.final('utf8');

    callback(dec);

  },

  parse_xml: function(body, callback){

    logger.debug('Parsing XML...');
    var xml_parser = new xml2js.Parser();

    xml_parser.on('end', function(result) {
      callback(null, result);
    });

    xml_parser.on('error', function(err) {
      callback(err);
    });

    xml_parser.parseString(body);

  },

  // this function builds a new instruction schema out of the old XML
  build_new_schema: function(original, options, callback){

    // logger.debug(original);

    var excluded_settings = ['current_release', 'delay', 'auto_update',
        'post_url', 'on_demand_mode', 'on_demand_host', 'on_demand_port'];

    var data = {
      current_release: original.configuration.current_release,
      missing: original.status && original.status.missing === 'true' ? true : false,
      // delay: parseInt(original.configuration.delay),
      auto_update: original.configuration.auto_update === 'y' ? true : false,
      settings:  {},
      drivers:   {},
      reports:   {},
      endpoints: {}
    };

    for(var key in original.configuration){
      if(excluded_settings.indexOf(key) === -1)
        data.settings[key] = original.configuration[key]['#'] || original.configuration[key];
    }

    // events endpoint expects a PUT
    // data.destinations.events.control_panel.method = 'put';

    if(original.configuration.post_url)
      data.endpoints.report = {
        control_panel: {
          url: original.configuration.post_url
        }
      };

      if(original.configuration.on_demand_mode){
        data.drivers['on-demand'] = {
          host: original.configuration.on_demand_host,
          port: parseInt(original.configuration.on_demand_port),
          device_key: options.device_key,
          group_key: options.api_key
        };
      }

      data.actions = {};
      var include_in_report = [];

      for(var id in original.modules.module){

        var module_data =  original.modules.module[id];
        var module_options = module_data;
        if(!module_data) continue;

        if(module_data['@']){
          module_data = module_data['@'];
          delete module_options['@'];
        } else {
          module_options = {};
        }

        if(module_data.type === 'report'){

          if(module_data.name === 'webcam'){
            include_in_report.push('picture');
            continue;
          }

          for(key in module_options){

            var val = module_options[key];
            if(val === 'n' || val === 'false') continue;

            if(/^get_/.test(key)){
              include_in_report.push(key.replace('get_', ''));
            } else if (val === 'y' || val === 'true'){
              include_in_report.push(key);
            }

          }

        } else {
          if(module_data.name === 'system')
            data.reports.specs = true;
          else
            data.actions[module_data.name] = module_options;
        }
      }

      if(include_in_report.length > 0){
        data.reports.location = {
          include: include_in_report,
          interval: parseInt(original.configuration.delay)
        };
      }

      // data.actions.push({name: 'report', options: report_opts});

      if(process.env.DEBUG) console.log(data);
      callback(null, data);

    }
  };

module.exports = ResponseParser;
