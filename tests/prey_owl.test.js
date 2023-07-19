const prey_owl = require('../lib/conf/tasks/prey_owl');
const timeToExpire = 2000;

let mockEnsureStarted = jest.fn();
let mockEnsureCreated = jest.fn();
let mockEnsureDestroyed = jest.fn();

const initMockData = () => {
    mockEnsureStarted = jest.fn().mockImplementation((cb) => {
        return cb && cb();
    });
    mockEnsureCreated = jest.fn().mockImplementation((cb) => {
        return cb && cb();
    });
    mockEnsureDestroyed = jest.fn().mockImplementation((cmd, cb) => {
        return cb && cb();
    });
    
    prey_owl.start_watcher = mockEnsureStarted;
    prey_owl.create_watcher = mockEnsureCreated;
    prey_owl.remove_single_watcher = mockEnsureDestroyed;
};
//1 - 
test(`new_prey-user=0.0.3|prey/=yes|prey/version=no|old_prey-user=0.0.2|new_config=no|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo exists`;
    prey_owl.cmdInstallPreyUserVersion = `echo '0.0.2'`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo ''`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(mockEnsureCreated.mock.calls).toHaveLength(1);
        expect(mockEnsureStarted.mock.calls).toHaveLength(1);
        done();
    });
}, timeToExpire);
//2
test(`new_prey-user=0.0.2|prey/=yes|prey/version=no|old_prey-user=0.0.3|new_config=no|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.2'";

    prey_owl.cmdExistInstallPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallPreyUserVersion = `echo '0.0.3'`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo ''`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe("New version < old version");
        done();
    });
}, timeToExpire);
//3
test(`new_prey-user=0.0.3|prey/=no|prey/version=yes|old_prey-user=0.0.2|new_config=no|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo '0.0.2'`;

    prey_owl.existsNewPath = `echo ''`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(mockEnsureCreated.mock.calls).toHaveLength(1);
        expect(mockEnsureStarted.mock.calls).toHaveLength(1);
        done();
    });
}, timeToExpire);
//4
test(`new_prey-user=0.0.2|prey/=no|prey/version=yes|old_prey-user=0.0.3|new_config=no|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.2'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo '0.0.3'`;

    prey_owl.existsNewPath = `echo ''`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe("New version < old version");
        done();
    });
}, timeToExpire);
//5
test(`new_prey-user=0.0.3|prey/=no|prey/version=no|old_prey-user=|new_config=no|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo ''`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(mockEnsureCreated.mock.calls).toHaveLength(1);
        expect(mockEnsureStarted.mock.calls).toHaveLength(1);
        done();
    });
}, timeToExpire);
//6
test(`new_prey-user=0.0.3|prey/=no|prey/version=no|old_prey-user=|new_config=yes|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe(`com.prey.owl.plist doesn't exist: `);
        done();
    });
}, timeToExpire);
//7
test(`new_prey-user=0.0.3|prey/=no|prey/version=no|old_prey-user=|new_config=yes|old_config=yes`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo 'exists'`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe("Delete prey binary in /prey/: ");
        done();
    });
}, timeToExpire);

test(`new_prey-user=0.0.3|prey/=yes|prey/version=no|old_prey-user=0.0.2|new_config=yes|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallPreyUserVersion = `echo '0.0.2'`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe(`com.prey.owl.plist doesn't exist: `);
        done();
    });
}, timeToExpire);

test(`new_prey-user=0.0.2|prey/=yes|prey/version=no|old_prey-user=0.0.3|new_config=yes|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.2'";

    prey_owl.cmdExistInstallPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallPreyUserVersion = `echo '0.0.3'`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe(`New version < old version`);
        done();
    });
}, timeToExpire);

test(`new_prey-user=0.0.3|prey/=yes|prey/version=no|old_prey-user=0.0.2|new_config=yes|old_config=yes`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallPreyUserVersion = `echo '0.0.2'`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo 'exists'`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(mockEnsureDestroyed.mock.calls).toHaveLength(1);
        expect(errorMsg).toBe(`Delete prey binary in /prey/: `);
        done();
    });
}, timeToExpire);

test(`new_prey-user=0.0.2|prey/=yes|prey/version=no|old_prey-user=0.0.3|new_config=yes|old_config=yes`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.2'";

    prey_owl.cmdExistInstallPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallPreyUserVersion = `echo '0.0.3'`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo ''`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo ''`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo 'exists'`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe(`New version < old version`);
        done();
    });
}, timeToExpire);
////
test(`new_prey-user=0.0.3|prey/=no|prey/version=yes|old_prey-user=0.0.2|new_config=yes|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo '0.0.2'`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe(`com.prey.owl.plist doesn't exist: `);
        done();
    });
}, timeToExpire);

test(`new_prey-user=0.0.2|prey/=no|prey/version=yes|old_prey-user=0.0.3|new_config=yes|old_config=no`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.2'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo '0.0.3'`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo ''`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe("New version < old version");
        done();
    });
}, timeToExpire);

test(`new_prey-user=0.0.3|prey/=no|prey/version=yes|old_prey-user=0.0.2|new_config=yes|old_config=yes`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.3'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo '0.0.2'`;

    prey_owl.existsNewPath = `echo 'exists'`;
    prey_owl.existsOldpath = `echo 'exists'`;
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe("Delete prey binary in /prey/: ");
        done();
    });
}, timeToExpire);

test(`new_prey-user=0.0.2|prey/=no|prey/version=yes|old_prey-user=0.0.3|new_config=yes|old_config=yes`, (done) => {
    initMockData();

    prey_owl.cmdExistsCurrentBinPreyUser = "echo 'exists'";
    prey_owl.cmdCurrentBinPreyUserVersion = "echo '0.0.2'";

    prey_owl.cmdExistInstallPreyUser = `echo ''`;
    prey_owl.cmdInstallPreyUserVersion = `echo ''`;
    
    prey_owl.cmdExistsInstallVersionPreyUser = `echo 'exists'`;
    prey_owl.cmdInstallVersionsreyUserVersion = `echo '0.0.3'`;

    prey_owl.existsNewPath = `echo 'exists'`
    prey_owl.existsOldpath = `echo 'exists'`
    prey_owl.deleteInstallPreyUserBinary = `echo 'exists'`;
    prey_owl.copyCurrentToInstallVersionPath = `echo 'exists'`;
    
    prey_owl.copyToDestination = `echo 'exists'`;

    prey_owl.trigger_set_watcher((errorMsg) => {
        expect(errorMsg).toBe("New version < old version");
        done();
    });
}, timeToExpire);