var request_format = '.xml';

exports.control_panel_url = "http://control.preyproject.com";

exports.profile_url = 'https://control.preyproject.com/profile' + request_format;
exports.new_account_url = 'https://control.preyproject.com/register' + request_format;
exports.new_device_url = 'https://control.preyproject.com/devices' + request_format;

exports.crash_reports_url = "http://exceptions.preyproject.com";

exports.device = function(device_key){

	if(!device_key || device_key == '') return {};

	var url = exports.control_panel_url + '/devices/' + device_key;

	return {
		url: url + request_format,
		traces_url: url + '/data' + request_format,
		events_url: url + '/events' + request_format,
		report_url: url + '/reports' + request_format
	}

};
