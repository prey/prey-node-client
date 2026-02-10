/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const rewire = require('rewire');

describe('Command Queue Module', () => {
  let commandQueueRewired;
  let mockHooks;
  let mockEmitter;
  let mockLogger;
  let clock;

  beforeEach(() => {
    // Use fake timers for timeout testing
    clock = sinon.useFakeTimers();

    // Rewire command-queue module
    commandQueueRewired = rewire('../../../../../lib/agent/control-panel/websockets/command-queue');

    // Mock hooks
    mockHooks = new EventEmitter();
    mockHooks.trigger = sinon.stub();

    // Mock emitter
    mockEmitter = new EventEmitter();

    // Mock logger
    mockLogger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };
  });

  afterEach(() => {
    clock.restore();
    commandQueueRewired.clearAllQueues();
  });

  describe('initialize', () => {
    it('should initialize with hooks', () => {
      commandQueueRewired.initialize(mockHooks);
      // Should not throw
      expect(true).to.be.true;
    });

    it('should only initialize once', () => {
      commandQueueRewired.initialize(mockHooks);
      commandQueueRewired.initialize(mockHooks);
      // Second call should be ignored
      expect(true).to.be.true;
    });

    it('should listen to action events for cleanup', (done) => {
      commandQueueRewired.initialize(mockHooks);

      // Enqueue a command
      const command = {
        id: 'action-1',
        body: { target: 'alert', command: 'start' },
      };

      let commandEmitted = false;
      mockEmitter.on('command', (cmd) => {
        expect(cmd.id).to.equal('action-1');
        commandEmitted = true;
      });

      const result = commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);
      expect(result).to.be.true;
      expect(commandEmitted).to.be.true;

      // Verify command is executing
      const status = commandQueueRewired.getQueueStatus('alert');
      expect(status.isExecuting).to.be.true;
      expect(status.executingId).to.equal('action-1');

      // Emit action stopped event
      mockHooks.emit('action', 'stopped', 'action-1');

      // Verify command was removed
      const statusAfter = commandQueueRewired.getQueueStatus('alert');
      expect(statusAfter.isExecuting).to.be.false;
      expect(statusAfter.executingId).to.be.null;

      done();
    });
  });

  describe('enqueueCommand', () => {
    beforeEach(() => {
      commandQueueRewired.initialize(mockHooks);
    });

    it('should execute command immediately if none running', (done) => {
      const command = {
        id: 'cmd-1',
        body: { target: 'lock', command: 'start' },
      };

      mockEmitter.on('command', (cmd) => {
        expect(cmd.id).to.equal('cmd-1');
        expect(mockLogger.info.calledWith(sinon.match(/Executing command of type 'lock' immediately/))).to.be.true;
        done();
      });

      const result = commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);
      expect(result).to.be.true;
    });

    it('should reject duplicate command if same type is executing', () => {
      const command1 = {
        id: 'cmd-1',
        body: { target: 'alert', command: 'start' },
      };

      const command2 = {
        id: 'cmd-2',
        body: { target: 'alert', command: 'start' },
      };

      let rejectedCommand = null;
      mockEmitter.on('command_rejected', (data) => {
        rejectedCommand = data;
      });

      // First command should execute
      const result1 = commandQueueRewired.enqueueCommand(command1, mockEmitter, mockLogger);
      expect(result1).to.be.true;

      // Second command should be rejected
      const result2 = commandQueueRewired.enqueueCommand(command2, mockEmitter, mockLogger);
      expect(result2).to.be.false;
      expect(rejectedCommand).to.not.be.null;
      expect(rejectedCommand.command.id).to.equal('cmd-2');
      expect(rejectedCommand.reason).to.equal('Already running: alert');
      expect(mockLogger.warn.calledWith(sinon.match(/already executing, rejecting duplicate/))).to.be.true;
    });

    it('should allow different command types to execute simultaneously', () => {
      const lockCommand = {
        id: 'lock-1',
        body: { target: 'lock', command: 'start' },
      };

      const alertCommand = {
        id: 'alert-1',
        body: { target: 'alert', command: 'start' },
      };

      let emittedCommands = [];
      mockEmitter.on('command', (cmd) => {
        emittedCommands.push(cmd.id);
      });

      const result1 = commandQueueRewired.enqueueCommand(lockCommand, mockEmitter, mockLogger);
      const result2 = commandQueueRewired.enqueueCommand(alertCommand, mockEmitter, mockLogger);

      expect(result1).to.be.true;
      expect(result2).to.be.true;
      expect(emittedCommands).to.include('lock-1');
      expect(emittedCommands).to.include('alert-1');
    });

    it('should set safety timeout for command execution', () => {
      const command = {
        id: 'cmd-1',
        body: { target: 'lock', command: 'start' },
      };

      commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);

      // Verify command is executing
      let status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.true;

      // Fast-forward past the timeout (default 30 seconds)
      clock.tick(30001);

      // Verify command was cleaned up
      status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.false;
      expect(mockLogger.warn.calledWith(sinon.match(/didn't send completion event/))).to.be.true;
    });

    it('should clear timeout when action completes via hook', () => {
      const command = {
        id: 'cmd-1',
        body: { target: 'lock', command: 'start' },
      };

      commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);

      // Complete the action via hook
      mockHooks.emit('action', 'stopped', 'cmd-1');

      // Fast-forward past the timeout
      clock.tick(30001);

      // Timeout warning should not be logged since action completed normally
      const timeoutWarnings = mockLogger.warn.getCalls().filter((call) =>
        call.args[0].includes("didn't send completion event")
      );
      expect(timeoutWarnings).to.have.length(0);
    });
  });

  describe('processCommands', () => {
    beforeEach(() => {
      commandQueueRewired.initialize(mockHooks);
    });

    it('should process array of commands', () => {
      const commands = [
        { id: 'cmd-1', body: { target: 'lock', command: 'start' } },
        { id: 'cmd-2', body: { target: 'alert', command: 'start' } },
      ];

      let emittedCommands = [];
      mockEmitter.on('command', (cmd) => {
        emittedCommands.push(cmd.id);
      });

      commandQueueRewired.processCommands(commands, mockEmitter, mockLogger);

      expect(emittedCommands).to.have.length(2);
      expect(emittedCommands).to.include('cmd-1');
      expect(emittedCommands).to.include('cmd-2');
    });

    it('should reject duplicate commands in array', () => {
      const commands = [
        { id: 'cmd-1', body: { target: 'alert', command: 'start' } },
        { id: 'cmd-2', body: { target: 'alert', command: 'start' } },
      ];

      let rejectedCount = 0;
      mockEmitter.on('command_rejected', () => {
        rejectedCount++;
      });

      commandQueueRewired.processCommands(commands, mockEmitter, mockLogger);

      expect(rejectedCount).to.equal(1);
    });

    it('should handle non-array input', () => {
      commandQueueRewired.processCommands('not-an-array', mockEmitter, mockLogger);
      expect(mockLogger.error.calledWith('processCommands expects an array')).to.be.true;
    });
  });

  describe('getQueueStatus', () => {
    beforeEach(() => {
      commandQueueRewired.initialize(mockHooks);
    });

    it('should return not executing for empty queue', () => {
      const status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.false;
      expect(status.executingId).to.be.null;
    });

    it('should return executing status with command ID', () => {
      const command = {
        id: 'cmd-1',
        body: { target: 'lock', command: 'start' },
      };

      commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);

      const status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.true;
      expect(status.executingId).to.equal('cmd-1');
    });
  });

  describe('clearQueue', () => {
    beforeEach(() => {
      commandQueueRewired.initialize(mockHooks);
    });

    it('should clear specific target queue', () => {
      const command = {
        id: 'cmd-1',
        body: { target: 'lock', command: 'start' },
      };

      commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);

      let status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.true;

      commandQueueRewired.clearQueue('lock');

      status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.false;
    });

    it('should clear timeout when clearing queue', () => {
      const command = {
        id: 'cmd-1',
        body: { target: 'lock', command: 'start' },
      };

      commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);
      commandQueueRewired.clearQueue('lock');

      // Fast-forward past timeout
      clock.tick(30001);

      // No timeout warning should be logged
      const timeoutWarnings = mockLogger.warn.getCalls().filter((call) =>
        call.args[0].includes("didn't send completion event")
      );
      expect(timeoutWarnings).to.have.length(0);
    });
  });

  describe('clearAllQueues', () => {
    beforeEach(() => {
      commandQueueRewired.initialize(mockHooks);
    });

    it('should clear all executing commands', () => {
      const commands = [
        { id: 'lock-1', body: { target: 'lock', command: 'start' } },
        { id: 'alert-1', body: { target: 'alert', command: 'start' } },
      ];

      commands.forEach((cmd) => {
        commandQueueRewired.enqueueCommand(cmd, mockEmitter, mockLogger);
      });

      let lockStatus = commandQueueRewired.getQueueStatus('lock');
      let alertStatus = commandQueueRewired.getQueueStatus('alert');
      expect(lockStatus.isExecuting).to.be.true;
      expect(alertStatus.isExecuting).to.be.true;

      commandQueueRewired.clearAllQueues();

      lockStatus = commandQueueRewired.getQueueStatus('lock');
      alertStatus = commandQueueRewired.getQueueStatus('alert');
      expect(lockStatus.isExecuting).to.be.false;
      expect(alertStatus.isExecuting).to.be.false;
    });
  });

  describe('getAllQueuesStatus', () => {
    beforeEach(() => {
      commandQueueRewired.initialize(mockHooks);
    });

    it('should return empty object when no commands executing', () => {
      const status = commandQueueRewired.getAllQueuesStatus();
      expect(status).to.deep.equal({});
    });

    it('should return all executing commands', () => {
      const commands = [
        { id: 'lock-1', body: { target: 'lock', command: 'start' } },
        { id: 'alert-1', body: { target: 'alert', command: 'start' } },
      ];

      commands.forEach((cmd) => {
        commandQueueRewired.enqueueCommand(cmd, mockEmitter, mockLogger);
      });

      const status = commandQueueRewired.getAllQueuesStatus();
      expect(status).to.have.property('lock');
      expect(status).to.have.property('alert');
      expect(status.lock.isExecuting).to.be.true;
      expect(status.lock.executingId).to.equal('lock-1');
      expect(status.alert.isExecuting).to.be.true;
      expect(status.alert.executingId).to.equal('alert-1');
    });
  });

  describe('Action completion flow', () => {
    beforeEach(() => {
      commandQueueRewired.initialize(mockHooks);
    });

    it('should free up queue when action stops', (done) => {
      const command1 = {
        id: 'alert-1',
        body: { target: 'alert', command: 'start' },
      };

      const command2 = {
        id: 'alert-2',
        body: { target: 'alert', command: 'start' },
      };

      let rejectedCount = 0;
      mockEmitter.on('command_rejected', () => {
        rejectedCount++;
      });

      // Enqueue first command
      commandQueueRewired.enqueueCommand(command1, mockEmitter, mockLogger);

      // Try to enqueue second command - should be rejected
      commandQueueRewired.enqueueCommand(command2, mockEmitter, mockLogger);
      expect(rejectedCount).to.equal(1);

      // Complete first action
      mockHooks.emit('action', 'stopped', 'alert-1');

      // Now second command should be accepted
      const result = commandQueueRewired.enqueueCommand(command2, mockEmitter, mockLogger);
      expect(result).to.be.true;
      expect(rejectedCount).to.equal(1); // No additional rejection

      done();
    });

    it('should free up queue when action fails', () => {
      const command = {
        id: 'lock-1',
        body: { target: 'lock', command: 'start' },
      };

      commandQueueRewired.enqueueCommand(command, mockEmitter, mockLogger);

      let status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.true;

      // Emit failed event
      mockHooks.emit('action', 'failed', 'lock-1');

      status = commandQueueRewired.getQueueStatus('lock');
      expect(status.isExecuting).to.be.false;
    });
  });
});
