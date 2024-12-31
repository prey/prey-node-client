const { expect } = require('chai');
const sinon = require('sinon');
const logger = require('../../../../../lib/agent/control-panel/api/logger');

describe('Logger Module', () => {
  let writerMock;

  beforeEach(() => {
    writerMock = {
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy(),
    };
    logger.use(writerMock);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('write function', () => {
    it('should call the correct writer method for debug', () => {
      logger.write('debug', 'Debug message');
      expect(writerMock.debug.calledOnceWith('Debug message')).to.be.true;
    });

    it('should call the correct writer method for info', () => {
      logger.write('info', 'Info message');
      expect(writerMock.info.calledOnceWith('Info message')).to.be.true;
    });

    it('should call the correct writer method for warn', () => {
      logger.write('warn', 'Warn message');
      expect(writerMock.warn.calledOnceWith('Warn message')).to.be.true;
    });

    it('should call the correct writer method for error', () => {
      logger.write('error', 'Error message');
      expect(writerMock.error.calledOnceWith('Error message')).to.be.true;
    });

    it('should not fail if writer is not set', () => {
      logger.use(null);
      expect(() => logger.write('info', 'This should not fail')).to.not.throw();
    });
  });

  describe('specific log methods', () => {
    it('should call writer.debug for logger.debug', () => {
      logger.debug('Debugging message');
      expect(writerMock.debug.calledOnceWith('Debugging message')).to.be.true;
    });

    it('should call writer.info for logger.info', () => {
      logger.info('Informational message');
      expect(writerMock.info.calledOnceWith('Informational message')).to.be.true;
    });

    it('should call writer.warn for logger.warn', () => {
      logger.warn('Warning message');
      expect(writerMock.warn.calledOnceWith('Warning message')).to.be.true;
    });

    it('should call writer.error for logger.error', () => {
      logger.error('Error message');
      expect(writerMock.error.calledOnceWith('Error message')).to.be.true;
    });
  });

  describe('use function', () => {
    it('should set the writer', () => {
      const newWriter = { debug: sinon.spy() };
      logger.use(newWriter);
      logger.debug('Testing new writer');
      expect(newWriter.debug.calledOnceWith('Testing new writer')).to.be.true;
    });
  });
});
