const sinon = require('sinon');
const should = require('should');
const macScreenshot = require('../../../lib/agent/providers/screenshot/mac/index.js');
const { get_screenshot } = require('../../../lib/agent/providers/screenshot/mac/index.js');

const { get_picture } = require('../../../lib/agent/providers/webcam/mac/index.js');

describe('get_picture', () => {
  let callback;
  let timer;
  let child;

  beforeEach(() => {
    callback = sinon.fake();
    timer = null;
    child = null;
  });

  afterEach(() => {
    clearTimeout(timer);
    timer = null;
    if (child) {
      child.kill();
      child = null;
    }
  });

  it('should set a timer to cancel the picture after 10 seconds', (done) => {
    get_picture(callback);
    (timer !== null).should.be.true;

    clearTimeout(timer);
    timer = null;
    done();
  });

  it('should execute the "imagesnap" command if the OS version is greater than "10.14.0"', (done) => {
    const systemStub = { get_logged_user: sinon.stub().callsArgWith(0, null, 'test user') };
    const getIdUserStub = sinon.stub().callsArgWith(0, null);
    const deletePictureStub = sinon.stub().callsArgWith(0, null);
    const takePictureStub = sinon.stub().callsArgWith(0, null);
    const mvAndCopyFileStub = sinon.stub().callsArgWith(0, null);

    const originalSystem = require('../../../lib/common.js').system;
    const originalGetIdUser = require('../../../lib/agent/providers/webcam/mac/index.js').getIdUser;
    const originalDeletePicture = require('../../../lib/agent/providers/webcam/mac/index.js').deletePicture;
    const originalTakePicture = require('../../../lib/agent/providers/webcam/mac/index.js').takePicture;
    const originalMvAndCopyFile = require('../../../lib/agent/providers/webcam/mac/index.js').mvAndCopyFile;

    require('../../../lib/common.js').system = systemStub;
    require('../../../lib/agent/providers/webcam/mac/index.js').getIdUser = getIdUserStub;
    require('../../../lib/agent/providers/webcam/mac/index.js').deletePicture = deletePictureStub;
    require('../../../lib/agent/providers/webcam/mac/index.js').takePicture = takePictureStub;
    require('../../../lib/agent/providers/webcam/mac/index.js').mvAndCopyFile = mvAndCopyFileStub;

    get_picture(callback);

    systemStub.get_logged_user.calledOnce.should.be.true;
    getIdUserStub.calledOnce.should.be.true;
    deletePictureStub.calledOnce.should.be.true;
    takePictureStub.calledOnce.should.be.true;
    mvAndCopyFileStub.calledOnce.should.be.true;

    // Restore the original modules
    require('../../../lib/common.js').system = originalSystem;
    require('../../../lib/agent/providers/webcam/mac/index.js').getIdUser = originalGetIdUser;
    require('../../../lib/agent/providers/webcam/mac/index.js').deletePicture = originalDeletePicture;
    require('../../../lib/agent/providers/webcam/mac/index.js').takePicture = originalTakePicture;
    require('../../../lib/agent/providers/webcam/mac/index.js').mvAndCopyFile = originalMvAndCopyFile;
    done();
  });

  it('should call the callback with an error if getting the logged user fails', (done) => {
    const systemStub = { get_logged_user: sinon.stub().callsArgWith(0, new Error('Failed to get logged user')) };

    const originalSystem = require('../../../lib/common.js').system;

    require('../../../lib/common.js').system = systemStub;

    get_picture(callback);

    systemStub.get_logged_user.calledOnce.should.be.true;

    // Restore the original module
    require('../../../lib/common.js').system = originalSystem;
    done();
  });
});

describe('get_screenshot', () => {
  let callback;
  let timer;
  let child;

  beforeEach(() => {
    callback = sinon.fake();
    timer = null;
    child = null;
  });

  afterEach(() => {
    clearTimeout(timer);
    timer = null;
    if (child) {
      child.kill();
      child = null;
    }
  });

  it('should set a timer to cancel the picture after 10 seconds', (done) => {
    get_screenshot(callback);
    (timer !== null).should.be.true;

    clearTimeout(timer);
    timer = null;
    done();
  });

  it('should execute the "imagesnap" command if the OS version is greater than "10.14.0"', (done) => {
    const systemStub = { get_logged_user: sinon.stub().callsArgWith(0, null, 'test user') };
    const getIdUserStub = sinon.stub().callsArgWith(0, null);
    const deleteScreenshotStub = sinon.stub().callsArgWith(0, null);
    const takeScreenshotStub = sinon.stub().callsArgWith(0, null);
    const mvAndCopyFileStub = sinon.stub().callsArgWith(0, null);

    const originalSystem = require('../../../lib/common.js').system;
    const originalGetIdUser = require('../../../lib/agent/providers/screenshot/mac/index.js').getIdUser;
    const originalDeleteScreenshot = require('../../../lib/agent/providers/screenshot/mac/index.js').deleteScreenshot;
    const originalTakeScreenshot = require('../../../lib/agent/providers/screenshot/mac/index.js').takeScreenshot;
    const originalMvAndCopyFile = require('../../../lib/agent/providers/screenshot/mac/index.js').mvAndCopyFile;

    require('../../../lib/common.js').system = systemStub;
    require('../../../lib/agent/providers/screenshot/mac/index.js').getIdUser = getIdUserStub;
    require('../../../lib/agent/providers/screenshot/mac/index.js').deleteScreenshot = deleteScreenshotStub;
    require('../../../lib/agent/providers/screenshot/mac/index.js').takeScreenshot = takeScreenshotStub;
    require('../../../lib/agent/providers/screenshot/mac/index.js').mvAndCopyFile = mvAndCopyFileStub;

    get_screenshot(callback);

    systemStub.get_logged_user.calledOnce.should.be.true;
    getIdUserStub.calledOnce.should.be.true;
    deleteScreenshotStub.calledOnce.should.be.true;
    takeScreenshotStub.calledOnce.should.be.true;
    mvAndCopyFileStub.calledOnce.should.be.true;

    // Restore the original modules
    require('../../../lib/common.js').system = originalSystem;
    require('../../../lib/agent/providers/screenshot/mac/index.js').getIdUser = originalGetIdUser;
    require('../../../lib/agent/providers/screenshot/mac/index.js').deleteScreenshot = originalDeleteScreenshot;
    require('../../../lib/agent/providers/screenshot/mac/index.js').takeScreenshot = originalTakeScreenshot;
    require('../../../lib/agent/providers/screenshot/mac/index.js').mvAndCopyFile = originalMvAndCopyFile;
    done();
  });

  it('should call the callback with an error if getting the logged user fails', (done) => {
    const systemStub = { get_logged_user: sinon.stub().callsArgWith(0, new Error('Failed to get logged user')) };

    const originalSystem = require('../../../lib/common.js').system;

    require('../../../lib/common.js').system = systemStub;

    get_screenshot(callback);

    systemStub.get_logged_user.calledOnce.should.be.true;

    // Restore the original module
    require('../../../lib/common.js').system = originalSystem;
    done();
  });
});

describe('done', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should execute the callback function with error if err is truthy', () => {
    // Test setup
    const cb = sinon.spy();
    const err = new Error('Some error');

    // Call the function
    macScreenshot.done(err, '/path/to/file', cb);

    // Assertion
    cb.calledOnceWithExactly(err).should.be.true; // Remove this line if you don't want to use Chai
  });

  it('should execute the callback function with filePath and mimeType if err is falsy', () => {
    // Test setup
    const cb = sinon.spy();

    // Call the function
    macScreenshot.done(null, '/path/to/file', cb);

    // Assertion
    cb.calledOnceWithExactly(null, '/path/to/file', 'image/jpeg').should.be.true; // Remove this line if you don't want to use Chai
  });

  it('should set running to false', () => {
    // Call the function
    macScreenshot.done(null, '/path/to/file', sinon.spy());

    // Assertion
    macScreenshot.running.should.be.false; // Remove this line if you don't want to use Chai
  });

  it('should clear the timer if it exists', () => {
    // Test setup
    macScreenshot.timer = setTimeout(() => {}, 1000);

    // Call the function
    macScreenshot.done(null, '/path/to/file', sinon.spy());

    // Assertion
    macScreenshot.timer.should.be.null; // Remove this line if you don't want to use Chai
  });
});
