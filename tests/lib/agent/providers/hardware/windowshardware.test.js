const sinon = require('sinon');
const { resolveTpmModuleInfo } = require('../../../../../lib/agent/providers/hardware/windows');

const testingTxt = 'Get-Tpm : The TBS service is not running and could not be started. (Exception \r\nfrom HRESULT: 0x80284008)\r\nAt line:1 char:1\r\n+ Get-Tpm | Select TpmPresent, TpmReady, ManufacturerIdTxt, Manufacture ...\r\n+ ~~~~~~~\r\n    + CategoryInfo          : NotSpecified: (:) [Get-Tpm], TpmWmiException\r\n    + FullyQualifiedErrorId : Microsoft.Tpm.Commands.TpmWmiException,Microsoft \r\n   .Tpm.Commands.GetTpmCommand\r\n \r\n';
// eslint-disable-next-line no-undef
describe('resolveTpmModuleInfo should get an error when info is a string', () => {
  // eslint-disable-next-line no-undef
  it('should set a timer to cancel the picture after 10 seconds', (done) => {
    resolveTpmModuleInfo(null, testingTxt, (err, info) => {
      sinon.match.truthy.test(err);
      sinon.match.falsy.test(info);
      done();
    });
  });
});
