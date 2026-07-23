/* eslint-disable no-undef */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const { EventEmitter } = require('events');

describe('conf/shared/log', () => {
  let log;
  let originalStdout;

  beforeEach(() => {
    log = rewire('../../../../lib/conf/shared/log');
    log.__set__('stream', null);
    originalStdout = process.stdout;
  });

  afterEach(() => {
    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      writable: true,
      configurable: true,
    });
    sinon.restore();
  });

  describe('empty message handling', () => {
    it('ignores undefined without writing', () => {
      const mock = new EventEmitter();
      mock.write = sinon.stub();
      log.__set__('stream', mock);
      log(undefined);
      expect(mock.write.called).to.be.false;
    });

    it('ignores null without writing', () => {
      const mock = new EventEmitter();
      mock.write = sinon.stub();
      log.__set__('stream', mock);
      log(null);
      expect(mock.write.called).to.be.false;
    });

    it('ignores empty string without writing', () => {
      const mock = new EventEmitter();
      mock.write = sinon.stub();
      log.__set__('stream', mock);
      log('');
      expect(mock.write.called).to.be.false;
    });

    it('ignores whitespace-only string without writing', () => {
      const mock = new EventEmitter();
      mock.write = sinon.stub();
      log.__set__('stream', mock);
      log('   ');
      expect(mock.write.called).to.be.false;
    });
  });

  describe('normal write', () => {
    it('writes the message followed by a newline', () => {
      const mock = new EventEmitter();
      const writeStub = sinon.stub();
      mock.write = writeStub;
      log.__set__('stream', mock);

      log('hello world');

      expect(writeStub.calledOnce).to.be.true;
      expect(writeStub.firstCall.args[0]).to.equal('hello world\n');
    });

    it('serializes objects with util.inspect', () => {
      const mock = new EventEmitter();
      const writeStub = sinon.stub();
      mock.write = writeStub;
      log.__set__('stream', mock);

      log({ key: 'value' });

      expect(writeStub.calledOnce).to.be.true;
      expect(writeStub.firstCall.args[0]).to.include('key');
      expect(writeStub.firstCall.args[0]).to.include('value');
    });

    it('calls toString() on Buffer instances without inspect', () => {
      const mock = new EventEmitter();
      const writeStub = sinon.stub();
      mock.write = writeStub;
      log.__set__('stream', mock);

      log(Buffer.from('buffered text'));

      expect(writeStub.calledOnce).to.be.true;
      expect(writeStub.firstCall.args[0]).to.equal('buffered text\n');
    });
  });

  describe('stream initialization', () => {
    it('uses process.stdout when it is writable', () => {
      const mockStdout = new EventEmitter();
      mockStdout.writable = true;
      const writeStub = sinon.stub();
      mockStdout.write = writeStub;

      Object.defineProperty(process, 'stdout', {
        value: mockStdout,
        writable: true,
        configurable: true,
      });

      log('hello');

      expect(writeStub.calledOnce).to.be.true;
    });

    it('uses the file fallback when process.stdout is not available', () => {
      const fallback = new EventEmitter();
      const writeStub = sinon.stub();
      fallback.write = writeStub;

      log.__set__('fs', {
        createWriteStream: sinon.stub().returns(fallback),
      });

      Object.defineProperty(process, 'stdout', {
        value: null,
        writable: true,
        configurable: true,
      });

      log('hello');

      expect(writeStub.calledOnce).to.be.true;
    });
  });

  describe('EPIPE error handling', () => {
    describe('synchronous EPIPE', () => {
      it('does not throw when stream.write raises a synchronous EPIPE', () => {
        const epipeErr = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
        const mock = new EventEmitter();
        mock.write = sinon.stub().throws(epipeErr);
        log.__set__('stream', mock);

        expect(() => log('test')).to.not.throw();
      });

      it('does not throw when stream.write raises a synchronous EIO', () => {
        const eioErr = Object.assign(new Error('write EIO'), { code: 'EIO' });
        const mock = new EventEmitter();
        mock.write = sinon.stub().throws(eioErr);
        log.__set__('stream', mock);

        expect(() => log('test')).to.not.throw();
      });

      it('uses the file fallback for the next write after a synchronous EPIPE', () => {
        const epipeErr = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
        const brokenStream = new EventEmitter();
        brokenStream.write = sinon.stub().throws(epipeErr);
        log.__set__('stream', brokenStream);

        const fallbackWrite = sinon.stub();
        const fallbackStream = new EventEmitter();
        fallbackStream.write = fallbackWrite;

        log.__set__('fs', {
          createWriteStream: sinon.stub().returns(fallbackStream),
        });

        log('first');   // triggers sync EPIPE → creates fallback
        log('second');  // should now write to fallback

        expect(fallbackWrite.calledOnce).to.be.true;
        expect(fallbackWrite.firstCall.args[0]).to.equal('second\n');
      });
    });

    describe('asynchronous EPIPE (stream error event)', () => {
      it('does not crash when the stream emits an error event', () => {
        const fallback1 = new EventEmitter();
        fallback1.write = sinon.stub();

        const fallback2 = new EventEmitter();
        fallback2.write = sinon.stub();

        let callCount = 0;
        log.__set__('fs', {
          createWriteStream: sinon.stub().callsFake(() => (callCount++ === 0 ? fallback1 : fallback2)),
        });

        Object.defineProperty(process, 'stdout', {
          value: null,
          writable: true,
          configurable: true,
        });

        // Init: fallback1 is created and .once('error', ...) is attached to it
        log('init');

        const epipeErr = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
        // Emitting error should NOT throw (handler is attached)
        expect(() => fallback1.emit('error', epipeErr)).to.not.throw();
      });

      it('switches to a new fallback after the stream emits an error event', () => {
        const fallback1 = new EventEmitter();
        fallback1.write = sinon.stub();

        const fallback2 = new EventEmitter();
        const fallback2Write = sinon.stub();
        fallback2.write = fallback2Write;

        let callCount = 0;
        log.__set__('fs', {
          createWriteStream: sinon.stub().callsFake(() => (callCount++ === 0 ? fallback1 : fallback2)),
        });

        Object.defineProperty(process, 'stdout', {
          value: null,
          writable: true,
          configurable: true,
        });

        log('init');

        const epipeErr = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
        fallback1.emit('error', epipeErr);

        // After the async error, stream should have switched to fallback2
        log('after error');

        expect(fallback2Write.calledOnce).to.be.true;
        expect(fallback2Write.firstCall.args[0]).to.equal('after error\n');
      });
    });
  });
});
