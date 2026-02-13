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
  let execStub;
  let sharedLogStub;

  beforeEach(() => {
    switcherRewired = rewire('../../../lib/conf/switcher');

    // Mock shared.log
    sharedLogStub = sinon.stub();
    switcherRewired.__set__('shared', {
      log: sharedLogStub,
    });

    // Stub fs.access
    fsAccessStub = sinon.stub(fs, 'access');

    // Stub exec
    execStub = sinon.stub();
    switcherRewired.__set__('exec', execStub);
  });

  afterEach(() => {
    fsAccessStub.restore();
    sinon.restore();
  });

  describe('getAdditionalCommands', () => {
    it('should return paths for available commands in order', (done) => {
      execStub.withArgs('which iwlist').callsFake((cmd, cb) => {
        cb(null, '/usr/sbin/iwlist\n');
      });
      execStub.withArgs('which dmidecode').callsFake((cmd, cb) => {
        cb(null, '/usr/sbin/dmidecode\n');
      });
      execStub.withArgs('which nmcli').callsFake((cmd, cb) => {
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
      execStub.withArgs('which iwlist').callsFake((cmd, cb) => {
        cb(new Error('not found'));
      });
      execStub.withArgs('which dmidecode').callsFake((cmd, cb) => {
        cb(null, '/usr/sbin/dmidecode\n');
      });
      execStub.withArgs('which nmcli').callsFake((cmd, cb) => {
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
      execStub.callsFake((cmd, cb) => {
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
      execStub.withArgs('which iwlist').callsFake((cmd, cb) => {
        setTimeout(() => cb(null, '/usr/sbin/iwlist\n'), 30);
      });
      execStub.withArgs('which dmidecode').callsFake((cmd, cb) => {
        setTimeout(() => cb(null, '/usr/sbin/dmidecode\n'), 10);
      });
      execStub.withArgs('which nmcli').callsFake((cmd, cb) => {
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

      execStub.withArgs(sinon.match(/rm -rf/)).callsFake((cmd, cb) => {
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

      execStub.withArgs(sinon.match(/rm -rf/)).callsFake((cmd, cb) => {
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

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/echo/)).callsFake((cmd, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/chmod 0440/)).callsFake((cmd, cb) => {
        cb(null);
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile(['/usr/sbin/iwlist', '/usr/bin/nmcli'], (err, created) => {
        expect(err).to.be.null;
        expect(created).to.be.true;
        expect(sharedLogStub.calledWith(sinon.match(/Creating new sudoers file/))).to.be.true;
        expect(execStub.calledWith(sinon.match(/51_prey_switcher/))).to.be.true;
        expect(execStub.calledWith(sinon.match(/chmod 0440/))).to.be.true;
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
      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/echo/)).callsFake((cmd, cb) => {
        sudoersContent = cmd;
        cb(null);
      });

      execStub.withArgs(sinon.match(/chmod/)).callsFake((cmd, cb) => {
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

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, cb) => {
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

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/echo/)).callsFake((cmd, cb) => {
        cb(new Error('Write failed'));
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile([], (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Failed to write sudoers file');
        done();
      });
    });

    it('should handle chmod error', (done) => {
      fsAccessStub.callsFake((path, mode, cb) => {
        cb(new Error('ENOENT'));
      });

      execStub.withArgs('mkdir -p /etc/sudoers.d').callsFake((cmd, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/echo/)).callsFake((cmd, cb) => {
        cb(null);
      });

      execStub.withArgs(sinon.match(/chmod/)).callsFake((cmd, cb) => {
        cb(new Error('chmod failed'));
      });

      const createNewFile = switcherRewired.__get__('createNewFile');
      createNewFile([], (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include('Failed to set sudoers file permissions');
        done();
      });
    });
  });

  describe('update (main function)', () => {
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

      switcherRewired.update((err) => {
        expect(err).to.be.null;
        expect(getAdditionalCommandsStub.called).to.be.true;
        expect(removeOldFileStub.called).to.be.true;
        expect(createNewFileStub.called).to.be.true;
        expect(sharedLogStub.calledWith(sinon.match(/Update completed successfully/))).to.be.true;
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

      switcherRewired.update((err) => {
        expect(err).to.be.null;
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
