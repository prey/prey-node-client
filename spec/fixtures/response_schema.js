module.exports = {
	current_release: '1.0.2',
	status: 'missing',
	auto_update: true,
	on_demand: {
		host: 'server.com',
		port: 123123
	},
	destinations: {
		report: {
			http: {
				url: 'http://my.server.com/reports',
				username: 'user',
				password: 'secret'
			},
		},
		events: {
			control_panel: {
				url: 'http://www.server.com/events'
			}
		},
		data: {
			smtp: {
				host: 'server.com',
				port: 25,
				recipient: 'hello@hola.com'
			}
		}
	},
	report: {
		screenshot: true,
		picture: true,
		location: true,
		running_programs: true,
		modified_files: {
			time: 10000,
			path: '/home'
		},
		traceroute: true
	},
	actions: [
	{
		name: 'lock',
		version: '1.0.2',
		options: {
			password: 'asdasdasd'
		}
	},
	{
		name: 'alarm',
		version: '1.0.2',
		options: {
			sound: 'siren.mp3'
		}
	},
	{
		name: 'desktop',
		version: '1.0.2',
		options: {
			view_only: true
		}
	}]
}
