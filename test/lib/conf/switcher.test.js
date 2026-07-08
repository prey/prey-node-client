/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const fs = require('fs');
const { exec } = require('child_process');

describe('Switcher Module', () => {
  let switcherRewired;
  let fsAccessStub;
  let fsReadFileStub;
  let execStub;
  let sharedLogStub;
  let hadGetuid;

  beforeEach(() => {
    switcherRewired = rewire('../../../lib/conf/switcher');

    // Mock shared.log
    sharedLogStub = sinon.stub();
    switcherRewired.__set__('shared', {
      log: sharedLogStub,
    });

    // Stub fs.access and fs.readFile
    fsAccessStub = sinon.stub(fs, 'access');
    fsReadFileStub = sinon.stub(fs, 'readFile');

    // Stub exec
    execStub = sinon.stub();
    switcherRewired.__set__('exec', execStub);

    // Default: not sudo-rs. Individual tests can override this.
    switcherRewired.__set__('isSudoRs', (cb) => cb(false));
  });

  afterEach(() => {
    sinon.restore();
    if (hadGetuid === false && process.getuid) {
      delete process.getuid;
      hadGetuid = undefined;
    }
  });

  describe('getAdditionalCommands', () => {
    it('should return paths for available commands in order', (done) => {
      execStub.withArgs('which iwlist').callsFake((cmd, opts, cb) => {
        cb(null, '/usr/sbin/iwlist\n');
      });
      execStub.withArgs('which dmidecode').callsFake((cmd, opts, cb) => {
        cb(null, '/usr/sbin/dmidecode\n');
      });
      execStub.withArgs('which nmcli').callsFake((cmd, opts, cb) => {
        cb(null, '/usr/bin/nmcli\n');
      });

      const getAdditionalCommands = switcherRewired.__get__('getAdditionalCommands');
      getAdditionalCommands((commands) => {
        expect(commands).to.be.an('array');
        expect(commands).to.have.lengthOf(3);
        expect(commands[0]).to.equal('/usr/sbin/iwlist');
        expect(commands[1]).to.equal('/usr/sbin/dmidecode');
        expect(commands[2]).to.equal('/usr/bin/nmcli');
        done();
      });
    });

    it('should return only available commands', (done) => {
      execStub.withArgs('which iwlist').callsFake((cmd, opts, cb) => {
        cb(new Error('not found'));
      });
      execStub.withArgs('which dmidecode').callsFake((cmd, opts, cb) => {
        cb(null, '/usr/sbin/dmidecode\n');
      });
      execStub.withArgs('which nmcli').callsFake((cmd, opts, cb) => {
        cb(null, '/usr/bin/nmcli\n');
      });

      const getAdditionalCommands = switcherRewired.__get__('getAdditionalCommands');
      getAdditionalCommands((commands) => {
        expect(commands).to.have.lengthOf(2);
        expect(commands[0]).to.equal('/usr/sbin/dmidecode');
        expect(commands[1]).to.equal('/usr/bin/nmcli');
        done();
      });
    });

    it('should return empty array if no commands available', (done) => {
      execStub.callsFake((cmd, opts, cb) => {
        cb(new Error('not found'));
      });

      const getAdditionalCommands = switcherRewired.__get__('getAdditionalCommands');
      getAdditionalCommands((commands) => {
        expect(commands).to.be.an('array');
        expect(commands).to.have.lengthOf(0);
        done();
      });
    });

    it('should maintain correct order regardless of which callbacks return first', (done) => {
      // Simulate dmidecode returning first, then nmcli, then iwlist
      execStub.withArgs('which iwlist').callsFake((cmd, opts, cb) => {
        setTimeout(() => cb(null, '/usr/sbin/iwlist\n'), 30);
      });
      execStub.withArgs('which dmidecode').callsFake((cmd, opts, cb) => {
        setTimeout(() => cb(null, '/usr/sbin/dmidecode\n'), 10);
      });
      execStub.withArgs('which nmcli').callsFake((cmd, opts, cb) => {
        setTimeout(() => cb(null, '/usr/bin/nmcli\n'), 20);
      });

      const getAdditionalCommands = switcherRewired.__get__('getAdditionalCommands');
      getAdditionalCommands((commands) => {
        expect(commands[0]).to.equal('/usr/sbin/iwlist');
        expect(commands[1]).to.equal('/usr/sbin/dmidecode');
        expect(commands[2]).to.equal('/usr/bin/nmcli');
        done();
      });
    });
  });

  describe('removeOldFile', () => {
    it('should remove old sudoers file if it exists', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(null); // File exists
      });

      execStub.withArgs(sinon.match(/rm -rf/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });

      const removeOldFile = switcherRewired.__get__('removeOldFile');
      removeOldFile((err) => {
        expect(err).to.be.null;
        expect(sharedLogStub.calledWith(sinon.match(/Removing old sudoers file/))).to.be.true;
        expect(sharedLogStub.calledWith('Old sudoers file removed successfully')).to.be.true;
        expect(execStub.calledWith(sinon.match(/50_prey_switcher/))).to.be.true;
        done();
      });
    });

    it('should do nothing if old file does not exist', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT')); // File doesn't exist
      });

      const removeOldFile = switcherRewired.__get__('removeOldFile');
      removeOldFile((err) => {
        expect(err).to.be.null;
        expect(execStub.called).to.be.false;
        done();
      });
    });

    it('should return error if removal fails', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(null); // File exists
      });

      execStub.withArgs(sinon.match(/rm -rf/)).callsFake((cmd, opts, cb) => {
        cb(new Error('Permission denied'));
      });

      const removeOldFile = switcherRewired.__get__('removeOldFile');
      removeOldFile((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Failed to remove old sudoers file');
        done();
      });
    });
  });

  describe('createNewFile', () => {
    it('should create new sudoers file with correct permissions', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT')); // File doesn't exist
      });

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/grep -q/)).callsFake((cmd, opts, cb) => {
        cb(null); // grep succeeds (includedir already exists)
      });

      execStub.withArgs(sinon.match(/umask.*echo/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile(['/usr/sbin/iwlist', '/usr/bin/nmcli'], (err, created) => {
        expect(err).to.be.null;
        expect(created).to.be.true;
        expect(sharedLogStub.calledWith(sinon.match(/Created new sudoers file/))).to.be.true;
        expect(execStub.calledWith(sinon.match(/51_prey_switcher/))).to.be.true;
        expect(execStub.calledWith(sinon.match(/umask 226/))).to.be.true;
        done();
      });
    });

    it('should not create file if it already exists', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(null); // File exists
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile([], (err, created) => {
        expect(err).to.be.null;
        expect(created).to.be.false;
        expect(sharedLogStub.calledWith(sinon.match(/already exists/))).to.be.true;
        done();
      });
    });

    it('should include additional commands in sudoers line', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      let sudoersContent = '';
      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/grep -q/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/umask.*echo/)).callsFake((cmd, opts, cb) => {
        sudoersContent = cmd;
        cb(null);
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      const additionalCommands = ['/usr/sbin/iwlist', '/usr/sbin/dmidecode', '/usr/bin/nmcli'];

      createNewFile(additionalCommands, (err) => {
        expect(err).to.be.null;
        expect(sudoersContent).to.include('/usr/sbin/iwlist');
        expect(sudoersContent).to.include('/usr/sbin/dmidecode');
        expect(sudoersContent).to.include('/usr/bin/nmcli');
        expect(sudoersContent).to.include('prey ALL=(ALL) NOPASSWD:');
        done();
      });
    });

    it('should handle mkdir error', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(new Error('Permission denied'));
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile([], (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Failed to create sudoers.d directory');
        done();
      });
    });

    it('should handle file write error', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/grep -q/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/umask.*echo/)).callsFake((cmd, opts, cb) => {
        cb(new Error('Write failed'));
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile([], (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Failed to create sudoers file');
        done();
      });
    });

    it('should use wrapper path instead of su wildcard when sudo-rs is detected', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(true));
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      let capturedCmd = '';
      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(null);
      });
      execStub.withArgs(sinon.match(/grep -q/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });
      execStub.withArgs(sinon.match(/umask.*echo/)).callsFake((cmd, opts, cb) => {
        capturedCmd = cmd;
        cb(null);
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile(['/usr/sbin/iwlist', '/usr/bin/nmcli'], (err, created) => {
        expect(err).to.be.null;
        expect(created).to.be.true;
        expect(capturedCmd).to.include('prey-su');
        expect(capturedCmd).to.not.include('[A-z]');
        expect(capturedCmd).to.not.include('!/usr/bin/su');
        done();
      });
    });

    it('should include wrapper even with no additional commands when sudo-rs is detected', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(true));
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      let capturedCmd = '';
      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(null);
      });
      execStub.withArgs(sinon.match(/grep -q/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });
      execStub.withArgs(sinon.match(/umask.*echo/)).callsFake((cmd, opts, cb) => {
        capturedCmd = cmd;
        cb(null);
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile([], (err, created) => {
        expect(err).to.be.null;
        expect(created).to.be.true;
        expect(capturedCmd).to.include('prey-su');
        done();
      });
    });

    it('should include su wildcard entries when traditional sudo is in use', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(false));
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      let capturedCmd = '';
      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(null);
      });
      execStub.withArgs(sinon.match(/grep -q/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });
      execStub.withArgs(sinon.match(/umask.*echo/)).callsFake((cmd, opts, cb) => {
        capturedCmd = cmd;
        cb(null);
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile(['/usr/bin/nmcli'], (err, created) => {
        expect(err).to.be.null;
        expect(created).to.be.true;
        expect(capturedCmd).to.include('/usr/bin/su [A-z]*');
        expect(capturedCmd).to.include('!/usr/bin/su root*');
        expect(capturedCmd).to.include('!/usr/bin/su -*');
        done();
      });
    });

    it('should handle grep error gracefully', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, opts, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/grep -q/)).callsFake((cmd, opts, cb) => {
        cb(new Error('grep failed')); // grep fails but shouldn't stop execution
      });

      execStub.withArgs(sinon.match(/umask.*echo/)).callsFake((cmd, opts, cb) => {
        cb(null);
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile([], (err, created) => {
        expect(err).to.be.null;
        expect(created).to.be.true;
        expect(sharedLogStub.calledWith(sinon.match(/Warning/))).to.be.true;
        done();
      });
    });
  });

  describe('migrateWildcardFile', () => {
    it('should remove v51 file on sudo-rs when it contains wildcard entries', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(true));
      fsAccessStub.callsFake((filePath, mode, cb) => cb(null)); // file exists
      fsReadFileStub.callsFake((filePath, enc, cb) => cb(null, 'prey ALL=(ALL) NOPASSWD: /usr/bin/su [A-z]*, !/usr/bin/su root*'));
      execStub.withArgs(sinon.match(/rm -rf.*51_prey_switcher/)).callsFake((cmd, opts, cb) => cb(null));

      const migrateWildcardFile = switcherRewired.__get__('migrateWildcardFile');
      migrateWildcardFile((err) => {
        expect(err).to.be.null;
        expect(execStub.calledWith(sinon.match(/rm -rf.*51_prey_switcher/))).to.be.true;
        done();
      });
    });

    it('should remove v51 file on sudo-rs even when it has no wildcards (unconditional migration)', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(true));
      execStub.withArgs(sinon.match(/rm -rf.*51_prey_switcher/)).callsFake((cmd, opts, cb) => cb(null));

      const migrateWildcardFile = switcherRewired.__get__('migrateWildcardFile');
      migrateWildcardFile((err) => {
        expect(err).to.be.null;
        expect(execStub.calledWith(sinon.match(/rm -rf.*51_prey_switcher/))).to.be.true;
        done();
      });
    });

    it('should skip on traditional sudo even if file has wildcards', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(false));

      const migrateWildcardFile = switcherRewired.__get__('migrateWildcardFile');
      migrateWildcardFile((err) => {
        expect(err).to.be.null;
        expect(execStub.called).to.be.false;
        done();
      });
    });

    it('should attempt removal on sudo-rs even when v51 file does not exist (rm -rf is idempotent)', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(true));
      execStub.withArgs(sinon.match(/rm -rf.*51_prey_switcher/)).callsFake((cmd, opts, cb) => cb(null));

      const migrateWildcardFile = switcherRewired.__get__('migrateWildcardFile');
      migrateWildcardFile((err) => {
        expect(err).to.be.null;
        expect(execStub.calledWith(sinon.match(/rm -rf.*51_prey_switcher/))).to.be.true;
        done();
      });
    });

    it('should return error if rm fails', (done) => {
      switcherRewired.__set__('isSudoRs', (cb) => cb(true));
      fsAccessStub.callsFake((filePath, mode, cb) => cb(null)); // file exists
      fsReadFileStub.callsFake((filePath, enc, cb) => cb(null, 'prey ALL=(ALL) NOPASSWD: /usr/bin/su [A-z]*'));
      execStub.withArgs(sinon.match(/rm -rf/)).callsFake((cmd, opts, cb) => cb(new Error('Permission denied')));

      const migrateWildcardFile = switcherRewired.__get__('migrateWildcardFile');
      migrateWildcardFile((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Failed to remove incompatible sudoers file');
        done();
      });
    });
  });

  describe('update (main function)', () => {
    const hadGetuid = typeof process.getuid === 'function';
    let innerSandbox;

    beforeEach(() => {
      innerSandbox = sinon.createSandbox();

      // Mock process.getuid to simulate running as root
      if (!process.getuid) {
        process.getuid = () => {};
      }
      innerSandbox.stub(process, 'getuid').returns(0);

      // Mock process.platform to be linux
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });
    });

    afterEach(() => {
      innerSandbox.restore();
      if (!hadGetuid && process.getuid) {
        delete process.getuid;
      }
    });

    it('should complete full update flow successfully', (done) => {
      // Mock getAdditionalCommands
      const getAdditionalCommandsStub = sinon.stub().callsFake((cb) => {
        cb(['/usr/bin/nmcli']);
      });
      switcherRewired.__set__('getAdditionalCommands', getAdditionalCommandsStub);

      // Mock removeOldFile
      const removeOldFileStub = sinon.stub().callsFake((cb) => {
        cb(null);
      });
      switcherRewired.__set__('removeOldFile', removeOldFileStub);

      // Mock createNewFile
      const createNewFileStub = sinon.stub().callsFake((commands, cb) => {
        cb(null, true);
      });
      switcherRewired.__set__('createNewFile', createNewFileStub);

      // Mock testImpersonation
      const testImpersonationStub = sinon.stub().callsFake((cb) => {
        cb(null);
      });
      switcherRewired.__set__('testImpersonation', testImpersonationStub);

      switcherRewired.update((err, message) => {
        expect(err).to.be.null;
        expect(message).to.include('updated successfully');
        expect(getAdditionalCommandsStub.called).to.be.true;
        expect(removeOldFileStub.called).to.be.true;
        expect(createNewFileStub.called).to.be.true;
        expect(testImpersonationStub.called).to.be.true;
        done();
      });
    });

    it('should report when new file was not created (already exists)', (done) => {
      const getAdditionalCommandsStub = sinon.stub().callsFake((cb) => {
        cb([]);
      });
      switcherRewired.__set__('getAdditionalCommands', getAdditionalCommandsStub);

      const removeOldFileStub = sinon.stub().callsFake((cb) => {
        cb(null);
      });
      switcherRewired.__set__('removeOldFile', removeOldFileStub);

      const createNewFileStub = sinon.stub().callsFake((commands, cb) => {
        cb(null, false); // Not created (already exists)
      });
      switcherRewired.__set__('createNewFile', createNewFileStub);

      switcherRewired.update((err, message) => {
        expect(err).to.be.null;
        expect(message).to.include('already configured');
        expect(sharedLogStub.calledWith(sinon.match(/already up to date/))).to.be.true;
        done();
      });
    });

    it('should handle removeOldFile error', (done) => {
      const getAdditionalCommandsStub = sinon.stub().callsFake((cb) => {
        cb([]);
      });
      switcherRewired.__set__('getAdditionalCommands', getAdditionalCommandsStub);

      const removeOldFileStub = sinon.stub().callsFake((cb) => {
        cb(new Error('Remove failed'));
      });
      switcherRewired.__set__('removeOldFile', removeOldFileStub);

      switcherRewired.update((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Remove failed');
        done();
      });
    });

    it('should handle createNewFile error', (done) => {
      const getAdditionalCommandsStub = sinon.stub().callsFake((cb) => {
        cb([]);
      });
      switcherRewired.__set__('getAdditionalCommands', getAdditionalCommandsStub);

      const removeOldFileStub = sinon.stub().callsFake((cb) => {
        cb(null);
      });
      switcherRewired.__set__('removeOldFile', removeOldFileStub);

      const createNewFileStub = sinon.stub().callsFake((commands, cb) => {
        cb(new Error('Create failed'));
      });
      switcherRewired.__set__('createNewFile', createNewFileStub);

      switcherRewired.update((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Create failed');
        done();
      });
    });

    it('should log warning and still call createNewFile when migrateWildcardFile fails', (done) => {
      const getAdditionalCommandsStub = sinon.stub().callsFake((cb) => {
        cb([]);
      });
      switcherRewired.__set__('getAdditionalCommands', getAdditionalCommandsStub);

      const removeOldFileStub = sinon.stub().callsFake((cb) => {
        cb(null);
      });
      switcherRewired.__set__('removeOldFile', removeOldFileStub);

      const migrateWildcardFileStub = sinon.stub().callsFake((cb) => {
        cb(new Error('Permission denied'));
      });
      switcherRewired.__set__('migrateWildcardFile', migrateWildcardFileStub);

      const createNewFileStub = sinon.stub().callsFake((commands, cb) => {
        cb(null, true);
      });
      switcherRewired.__set__('createNewFile', createNewFileStub);

      const testImpersonationStub = sinon.stub().callsFake((cb) => {
        cb(null);
      });
      switcherRewired.__set__('testImpersonation', testImpersonationStub);

      switcherRewired.update((err, message) => {
        expect(err).to.be.null;
        expect(message).to.include('updated successfully');
        expect(createNewFileStub.called).to.be.true;
        expect(sharedLogStub.calledWith(sinon.match(/WARNING.*could not remove/))).to.be.true;
        done();
      });
    });
  });

  describe('Constants', () => {
    it('should have correct sudoers file paths', () => {
      const SUDOERS_FILE_50 = switcherRewired.__get__('SUDOERS_FILE_50');
      const SUDOERS_FILE_51 = switcherRewired.__get__('SUDOERS_FILE_51');

      expect(SUDOERS_FILE_50).to.equal('/etc/sudoers.d/50_prey_switcher');
      expect(SUDOERS_FILE_51).to.equal('/etc/sudoers.d/51_prey_switcher');
    });

    it('should have correct user name', () => {
      const USER_NAME = switcherRewired.__get__('USER_NAME');
      expect(USER_NAME).to.equal('prey');
    });

    it('should have correct su command path', () => {
      const SU_CMD = switcherRewired.__get__('SU_CMD');
      expect(SU_CMD).to.equal('/usr/bin/su');
    });
  });
});
