/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

const op = (phase, extra = {}) => ({
  id: 'op1', kind: 'migrate', phase, ...extra,
});

describe('migrate action', () => {
  let migrate;
  let clock;
  let backend;
  let linked;

  const fakeBackend = (overrides = {}) => ({
    checkService: sinon.stub().callsFake((cb) => cb(null)),
    submit: sinon.stub().callsFake((cb) => cb(null, { error: false, message: '', operation: op('admitted') })),
    status: sinon.stub().callsFake((cb) => cb(null, { ready: true, operation: op('admitted') })),
    gopreyInstalled: sinon.stub().callsFake((cb) => cb(false)),
    ...overrides,
  });

  // run starts the action and resolves with what 'end' carried.
  const run = () => new Promise((resolve) => {
    migrate.start('cmd-1', {}, (err, emitter) => {
      expect(err).to.equal(null);
      emitter.once('end', (id, endErr, out) => resolve({ id, err: endErr, out }));
    });
  });

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    migrate = rewire('../../../../../lib/agent/actions/migrate');
    backend = fakeBackend();
    linked = true;
    migrate.__set__('backendFor', () => backend);
    migrate.__set__('recovery', { exists: () => true });
    migrate.__set__('config', {
      getData: (key) => (linked ? { 'control-panel.api_key': 'a', 'control-panel.device_key': 'd' }[key] : null),
    });
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  it('ends unsupported_platform without a backend', async () => {
    migrate.__set__('backendFor', () => null);
    const { err } = await run();
    expect(err.message).to.equal('unsupported_platform');
  });

  it('ends not_linked before touching the service', async () => {
    linked = false;
    const { err } = await run();
    expect(err.message).to.equal('not_linked');
    expect(backend.checkService.called).to.equal(false);
  });

  it('ends with the service gate token', async () => {
    backend.checkService.callsFake((cb) => cb('macsvc_too_old'));
    const { err } = await run();
    expect(err.message).to.equal('macsvc_too_old');
    expect(backend.submit.called).to.equal(false);
  });

  it('ends recovery_binary_missing when the bundle lacks prey-recovery', async () => {
    migrate.__set__('recovery', { exists: () => false });
    const { err } = await run();
    expect(err.message).to.equal('recovery_binary_missing');
    expect(backend.submit.called).to.equal(false);
  });

  it('ends with a nested submission token and never polls', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: true, message: 'rate_limited' }));
    const { err } = await run();
    expect(err.message).to.equal('rate_limited');
    expect(backend.status.called).to.equal(false);
  });

  it('ends service_unreachable on a transport error', async () => {
    backend.submit.callsFake((cb) => cb(new Error('socket_missing')));
    const { err } = await run();
    expect(err.message).to.equal('service_unreachable');
  });

  it('polls every 10 s, with no fixed window, until launched', async () => {
    let calls = 0;
    backend.status.callsFake((cb) => {
      calls += 1;
      cb(null, { ready: true, operation: op(calls < 30 ? 'admitted' : 'launched') });
    });
    const done = run();
    await clock.tickAsync(30 * 10000);
    const { id, err, out } = await done;
    expect(id).to.equal('cmd-1');
    expect(err).to.equal(null);
    expect(out).to.deep.equal({ phase: 'launched', operation_id: 'op1' });
    expect(calls).to.equal(30);
  });

  it('keeps polling through status errors', async () => {
    backend.status.onFirstCall().callsFake((cb) => cb(new Error('timeout')));
    backend.status.onSecondCall().callsFake((cb) => cb(null, { ready: true, operation: op('succeeded') }));
    const done = run();
    await clock.tickAsync(20000);
    const { err, out } = await done;
    expect(err).to.equal(null);
    expect(out.phase).to.equal('succeeded');
  });

  it('reports a pre-launch owner failure with its reason', async () => {
    backend.status.callsFake((cb) => cb(null, { ready: true, operation: op('failed', { reason: 'download_failed' }) }));
    const done = run();
    await clock.tickAsync(10000);
    const { err, out } = await done;
    expect(err.message).to.equal('download_failed');
    expect(out).to.deep.equal({ phase: 'failed', operation_id: 'op1' });
  });

  it('treats installer_failed with goprey installed as already migrated', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: false, existing: true, operation: op('failed', { reason: 'installer_failed' }) }));
    backend.gopreyInstalled.callsFake((cb) => cb(true));
    const { err, out } = await run();
    expect(err).to.equal(null);
    expect(out).to.deep.equal({ phase: 'failed', operation_id: 'op1', already_migrated: true });
  });

  it('reports installer_failed when goprey is not installed', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: false, existing: true, operation: op('failed', { reason: 'installer_failed' }) }));
    const { err } = await run();
    expect(err.message).to.equal('installer_failed');
  });

  it('ends at once for an existing terminal operation', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: false, existing: true, operation: op('succeeded') }));
    const { err, out } = await run();
    expect(err).to.equal(null);
    expect(out.phase).to.equal('succeeded');
    expect(backend.status.called).to.equal(false);
  });

  it('resolves an uncertain timeout through status', async () => {
    backend.submit.callsFake((cb) => cb(new Error('timeout')));
    let calls = 0;
    backend.status.callsFake((cb) => {
      calls += 1;
      cb(null, calls < 3 ? { ready: true } : { ready: true, operation: op('launched') });
    });
    const done = run();
    await clock.tickAsync(30000);
    const { err, out } = await done;
    expect(err).to.equal(null);
    expect(out.phase).to.equal('launched');
  });

  it('gives up an uncertain admission after 6 polls without an operation', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: true, message: 'recovery_migrate_failed' }));
    backend.status.callsFake((cb) => cb(null, { ready: false, reason: 'owner_unavailable' }));
    const done = run();
    await clock.tickAsync(60000);
    const { err } = await done;
    expect(err.message).to.equal('recovery_migrate_failed');
    expect(backend.status.callCount).to.equal(6);
  });

  it('stop ends polling without an error', async () => {
    const done = run();
    await clock.tickAsync(10000);
    migrate.stop();
    const { err } = await done;
    expect(err).to.equal(null);
    const before = backend.status.callCount;
    await clock.tickAsync(60000);
    expect(backend.status.callCount).to.equal(before);
  });

  it('ignores a callback from a stopped run once a new run has started', async () => {
    let releaseFirst;
    backend.submit.onFirstCall().callsFake((cb) => { releaseFirst = cb; });
    migrate.start('cmd-1', {}, (err, emitter) => emitter.once('end', () => {}));
    await clock.tickAsync(0);
    migrate.stop();
    const second = new Promise((resolve) => {
      migrate.start('cmd-2', {}, (err, emitter) => emitter.once('end', (id, endErr, out) => resolve({ id, endErr, out })));
    });
    let ended = false;
    second.then(() => { ended = true; });
    await clock.tickAsync(0);
    // The stale submit now resolves with a terminal operation.
    releaseFirst(null, { error: false, message: '', operation: op('succeeded') });
    await clock.tickAsync(0);
    expect(ended).to.equal(false);
    // Second run admitted, so one poll chain: one status call per interval.
    await clock.tickAsync(30000);
    expect(backend.status.callCount).to.equal(3);
    migrate.stop();
    await second;
  });
});
