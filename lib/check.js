var Check = {
	installation: function(){
		log(" -- Verifying Prey installation...")
	},
	http_config: function(){
		log(" -- Verifying API and Device keys...")
	},
	smtp_config: function(){
		log(" -- Verifying SMTP settings...")
	}
}

module.exports = Check;
