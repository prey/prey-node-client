const macWebcam = require('../mac');
const common = require('../../../common');
const sinon = require('sinon');
const should  = require('should');
const fs = require('fs');

describe('Webcam MacOS', () => {
  it('returns an error', (done) => {
    common.system.get_logged_user((err, user) => {
      macWebcam.getIdUser(user, () => {
        macWebcam.deletePicture(macWebcam.pictureUtilData.picture_path, macWebcam.pictureUtilData.tmp_picture, () => {
          const pathExistBef = fs.existsSync(macWebcam.pictureUtilData.picture_path);
          const tmPicExistBef = fs.existsSync(macWebcam.pictureUtilData.tmp_picture);
          pathExistBef.should.be.equal(false);
          tmPicExistBef.should.be.equal(false);
          console.log('macWebcam.pictureUtilData.app_path');
          console.log(macWebcam.pictureUtilData.app_path);
          macWebcam.takePicture(macWebcam.pictureUtilData.app_path, () => {
            console.log('macWebcam.pictureUtilData.picture_path');
            console.log(macWebcam.pictureUtilData.picture_path);
            setTimeout(() => {
              const pathExistAft = fs.existsSync(macWebcam.pictureUtilData.picture_path);
              pathExistAft.should.be.equal(true);
              done();
            }, 3000);
          });
        });
      });
    });
  });
});