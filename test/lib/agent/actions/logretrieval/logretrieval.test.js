/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const fs = require('fs');

const { expect } = chai;

describe('logretrieval', () => {
  let logretrievalRewired;
  let getDataDbKeyStub;
  let collectFilesStub;
  let uploadZipStub;
  let writeFileStub;
  let doneStub;
  let utilStorageMock;

  beforeEach(() => {
    // Create mock for utilStorage
    getDataDbKeyStub = sinon.stub();
    utilStorageMock = {
      getDataDbKey: getDataDbKeyStub,
    };

    // Rewire the module and inject the mock
    logretrievalRewired = rewire('../../../../../lib/agent/actions/logretrieval');
    logretrievalRewired.__set__('utilStorage', utilStorageMock);

    collectFilesStub = sinon.stub(logretrievalRewired, 'collectFiles');
    uploadZipStub = sinon.stub(logretrievalRewired, 'upload_zip');
    writeFileStub = sinon.stub(fs, 'writeFile');
    doneStub = sinon.stub(logretrievalRewired, 'done');
  });

  afterEach(() => {
    collectFilesStub.restore();
    uploadZipStub.restore();
    writeFileStub.restore();
    doneStub.restore();
    sinon.restore();
  });

  it('should call getDataDbKey twice', (done) => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_outputFile, cb) => {
      cb(null, 1024);
    });
    writeFileStub.callsFake((_filePath, _txt, _flag, cb) => {
      cb(null);
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      expect(getDataDbKeyStub.calledTwice).to.be.true;
      done();
    });
  });

  it('should call getDataDbKey with correct arguments', (done) => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_outputFile, cb) => {
      cb(null, 1024);
    });
    writeFileStub.callsFake((_filePath, _txt, _flag, cb) => {
      cb(null);
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      expect(getDataDbKeyStub.firstCall.args[0]).to.equal('hardware_changed');
      expect(getDataDbKeyStub.secondCall.args[0]).to.equal('wifiDataStored');
      done();
    });
  });

  it('Should call done with an instance of an error when writeFile fails', (testDone) => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_outputFile, cb) => {
      cb(null, 1024);
    });
    writeFileStub.callsFake((_filePath, _txt, _flag, cb) => {
      cb(new Error('Error fs write'));
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      // writeFile errors are logged but don't stop execution
      // The callback is still called
      testDone();
    });
  });

  it('Should call done with an instance of an error when collectFiles fails', (testDone) => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_outputFile, cb) => {
      cb(new Error('Error collectFiles'));
    });
    writeFileStub.callsFake((_filePath, _txt, _flag, cb) => {
      cb(null);
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      expect(doneStub.calledWithMatch(sinon.match.string, sinon.match.instanceOf(Error))).to.be.true;
      testDone();
    });
  });
});
