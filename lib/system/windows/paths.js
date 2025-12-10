exports.bin = 'prey.cmd';
exports.config = `${process.env.WINDIR}\\Prey`; // __dirname + '/../../../'
exports.temp = `${process.env.WINDIR}\\Temp`;
exports.program_data = `${process.env.ProgramData}\\prey\\fenix.log`;
exports.log = exports.config;
exports.log_file = `${exports.log}\\prey.log`;
exports.log_restarts = `${exports.log}\\prey_restarts.log`;
