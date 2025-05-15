/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const fs = require('fs');
const utilStorage = require('../../../../../lib/agent/utils/storage/utilstorage');

const { expect } = chai;

describe('logretrieval', () => {
  let logretrievalRewired;
  let getDataDbKeyStub;
  let collectFilesStub;
  let uploadZipStub;
  let writeFileStub;
  let doneStub;

  beforeEach(() => {
    logretrievalRewired = rewire('../../../../../lib/agent/actions/logretrieval');
    getDataDbKeyStub = sinon.stub(utilStorage, 'getDataDbKey');
    collectFilesStub = sinon.stub(logretrievalRewired, 'collectFiles');
    uploadZipStub = sinon.stub(logretrievalRewired, 'upload_zip');
    writeFileStub = sinon.stub(fs, 'writeFile');
    doneStub = sinon.stub(logretrievalRewired, 'done');
  });

  afterEach(() => {
    getDataDbKeyStub.restore();
    collectFilesStub.restore();
    uploadZipStub.restore();
    writeFileStub.restore();
    doneStub.restore();
  });

  it('should call getDataDbKey twice', () => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_method, cb) => {
      cb(null);
    });
    writeFileStub.callsFake((_filePath, _txt, flag, cb) => {
      cb(null);
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      expect(getDataDbKeyStub.calledTwice).to.be.true;
    });
  });

  it('should call getDataDbKey with correct arguments', () => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_method, cb) => {
      cb(null);
    });
    writeFileStub.callsFake((_filePath, _txt, flag, cb) => {
      cb(null);
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      expect(getDataDbKeyStub.firstCall.args[0]).to.equal('hardware_changed');
      expect(getDataDbKeyStub.secondCall.args[0]).to.equal('wifiDataStored');
    });
  });

  it('Should call done with an instance of an error when writeFile fails', () => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_method, cb) => {
      cb(null);
    });
    writeFileStub.callsFake((_filePath, _txt, flag, cb) => {
      cb(new Error('Error fs write'));
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      expect(doneStub.calledWithMatch(sinon.match.instanceOf(Error))).to.be.true;
    });
  });

  it('Should call done with an instance of an error when collectFiles fails', () => {
    doneStub.callsFake(() => {});
    getDataDbKeyStub.callsFake((_method, cb) => {
      cb(null, '{ "hola": 1 }');
    });
    collectFilesStub.callsFake((_method, cb) => {
      cb(new Error('Error collectFiles'));
    });
    writeFileStub.callsFake((_filePath, _txt, flag, cb) => {
      cb(null);
    });
    uploadZipStub.callsFake((_filePath, _bytes, cb) => {
      cb(null);
    });
    logretrievalRewired.start('id', {}, () => {
      expect(collectFilesStub.calledWithMatch(sinon.match.instanceOf(Error))).to.be.true;
    });
  });
});
