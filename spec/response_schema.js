module.exports = {
	current_release: '1.0.2',
	status: 'missing',
	auto_update: true,
	on_demand: {
		host: 'server.com',
		port: 123123
	},
	destinations: {
		http: {
			url: 'http://asdasd.com/reports'
		},
	},
	report: {
		screenshot: true,
		picture: true,
		geo: true,
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
		config: {
			password: 'asdasdasd'
		}
	},
	{
		name: 'alarm',
		version: '1.0.2',
		config: {
			sound: 'siren.mp3'
		}
	},
	{
		name: 'desktop',
		version: '1.0.2',
		config: {
			view_only: true
		}
	}]
}
