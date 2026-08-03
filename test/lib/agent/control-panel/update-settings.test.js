const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('processSettingsUpdate', () => {
  let updateSettingsModule;
  let mockConfig;
  let processSettingsUpdate;

  beforeEach(() => {
    updateSettingsModule = rewire('../../../../lib/agent/control-panel/update-settings');
    mockConfig = {
      getData: sinon.stub().returns(undefined),
      setData: sinon.stub(),
    };
    updateSettingsModule.__set__('config', mockConfig);
    processSettingsUpdate = updateSettingsModule.processSettingsUpdate;
  });

  it('stores global keys without prefix', () => {
    processSettingsUpdate({ global: { auto_update: true } });
    expect(mockConfig.setData.calledWith('auto_update', true)).to.be.true;
  });

  it('stores local keys with control-panel. prefix', () => {
    processSettingsUpdate({ local: { location_aware: false } });
    expect(mockConfig.setData.calledWith('control-panel.location_aware', false)).to.be.true;
  });

  it('converts null leaf values to false', () => {
    processSettingsUpdate({ local: { force_wifi_on: null } });
    expect(mockConfig.setData.calledWith('control-panel.force_wifi_on', false)).to.be.true;
  });

  it('skips update when new value equals stored value', () => {
    mockConfig.getData.withArgs('auto_update').returns(true);
    processSettingsUpdate({ global: { auto_update: true } });
    expect(mockConfig.setData.called).to.be.false;
  });

  it('skips permissions key when value is null', () => {
    processSettingsUpdate({ local: { permissions: null } });
    expect(mockConfig.setData.called).to.be.false;
  });

  it('recurses into permissions object when not null', () => {
    processSettingsUpdate({ local: { permissions: { wifi_location: 'true' } } });
    expect(mockConfig.setData.calledWith('control-panel.permissions.wifi_location', 'true')).to.be.true;
  });

  it('stores tracking_schedule as a whole object without recursing', () => {
    const schedule = {
      start_at: '07:00',
      end_at: '15:00',
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };
    processSettingsUpdate({ local: { tracking_schedule: schedule } });
    expect(mockConfig.setData.calledOnce).to.be.true;
    expect(mockConfig.setData.calledWith('control-panel.tracking_schedule', schedule)).to.be.true;
  });

  it('skips tracking_schedule when value is null', () => {
    processSettingsUpdate({ local: { tracking_schedule: null } });
    expect(mockConfig.setData.called).to.be.false;
  });

  it('processes both global and local in one call', () => {
    processSettingsUpdate({
      global: { auto_update: false },
      local: { scan_hardware: true },
    });
    expect(mockConfig.setData.calledWith('auto_update', false)).to.be.true;
    expect(mockConfig.setData.calledWith('control-panel.scan_hardware', true)).to.be.true;
  });
});
