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
  let logger;

  // The first status call is the pre-submit relaunch check: by default the
  // owner holds no operation, so the action submits.
  const fakeBackend = (overrides = {}) => {
    const status = sinon.stub().callsFake((cb) => cb(null, { ready: true, operation: op('admitted') }));
    status.onFirstCall().callsFake((cb) => cb(null, { ready: true }));
    return {
      checkService: sinon.stub().callsFake((cb) => cb(null)),
      submit: sinon.stub().callsFake((cb) => cb(null, { error: false, message: '', operation: op('admitted') })),
      status,
      gopreyInstalled: sinon.stub().callsFake((cb) => cb(false)),
      ...overrides,
    };
  };

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
    logger = { info: sinon.stub(), warn: sinon.stub() };
    migrate.__set__('logger', logger);
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
    backend.submit.callsFake((cb) => cb(null, { error: true, message: 'recovery_install_failed' }));
    const { err } = await run();
    expect(err.message).to.equal('recovery_install_failed');
    // Only the pre-submit relaunch check.
    expect(backend.status.callCount).to.equal(1);
  });

  it('resumes an admitted operation on relaunch without submitting', async () => {
    backend.status.onFirstCall().callsFake((cb) => cb(null, { ready: true, operation: op('admitted') }));
    let polls = 0;
    backend.status.callsFake((cb) => {
      polls += 1;
      cb(null, { ready: true, operation: op(polls < 3 ? 'admitted' : 'launched') });
    });
    const done = run();
    await clock.tickAsync(30000);
    const { err, out } = await done;
    expect(err).to.equal(null);
    expect(out).to.deep.equal({ phase: 'launched', operation_id: 'op1' });
    expect(backend.submit.called).to.equal(false);
  });

  it('submits when the relaunch status check fails', async () => {
    backend.status.onFirstCall().callsFake((cb) => cb(new Error('timeout')));
    backend.submit.callsFake((cb) => cb(null, { error: false, existing: true, operation: op('succeeded') }));
    const { err, out } = await run();
    expect(err).to.equal(null);
    expect(out.phase).to.equal('succeeded');
    expect(backend.submit.calledOnce).to.equal(true);
  });

  it('submits when the owner holds only a terminal operation', async () => {
    backend.status.onFirstCall().callsFake((cb) => cb(null, { ready: true, operation: op('failed', { reason: 'download_failed' }) }));
    backend.submit.callsFake((cb) => cb(null, { error: false, operation: op('launched', { id: 'op2' }) }));
    const { err, out } = await run();
    expect(err).to.equal(null);
    expect(out).to.deep.equal({ phase: 'launched', operation_id: 'op2' });
    expect(backend.submit.calledOnce).to.equal(true);
  });

  it('polls status after rate_limited and gives up after 6 polls with that token', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: true, message: 'rate_limited' }));
    backend.status.callsFake((cb) => cb(null, { ready: true }));
    const done = run();
    await clock.tickAsync(60000);
    const { err } = await done;
    expect(err.message).to.equal('rate_limited');
    expect(backend.status.callCount).to.equal(7);
  });

  it('resolves already_running through status', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: true, message: 'already_running' }));
    backend.status.callsFake((cb) => cb(null, { ready: true, operation: op('launched') }));
    const done = run();
    await clock.tickAsync(10000);
    const { err, out } = await done;
    expect(err).to.equal(null);
    expect(out.phase).to.equal('launched');
  });

  it('settles only on the admitted operation id', async () => {
    let polls = 0;
    backend.status.callsFake((cb) => {
      polls += 1;
      cb(null, { ready: true, operation: polls < 3 ? op('succeeded', { id: 'other' }) : op('launched') });
    });
    const done = run();
    await clock.tickAsync(30000);
    const { err, out } = await done;
    expect(err).to.equal(null);
    expect(out).to.deep.equal({ phase: 'launched', operation_id: 'op1' });
    expect(logger.warn.getCalls().filter((c) => String(c.args[0]).includes('other')).length).to.equal(1);
  });

  it('ignores an operation older than the submission while admission is uncertain', async () => {
    clock.setSystemTime(Date.parse('2026-10-16T12:00:10.500Z'));
    backend.submit.callsFake((cb) => cb(new Error('timeout')));
    backend.status.callsFake((cb) => cb(null, {
      ready: true, operation: op('failed', { reason: 'download_failed', updated_at: '2026-10-16T11:00:00Z' }),
    }));
    const done = run();
    await clock.tickAsync(60000);
    const { err } = await done;
    expect(err.message).to.equal('timeout');
  });

  it('accepts an operation updated since the submission while admission is uncertain', async () => {
    clock.setSystemTime(Date.parse('2026-10-16T12:00:10.500Z'));
    backend.submit.callsFake((cb) => cb(new Error('timeout')));
    // Second-resolution updated_at in the same second as the submission start.
    backend.status.callsFake((cb) => cb(null, {
      ready: true, operation: op('launched', { updated_at: '2026-10-16T12:00:10Z' }),
    }));
    const done = run();
    await clock.tickAsync(10000);
    const { err, out } = await done;
    expect(err).to.equal(null);
    expect(out.phase).to.equal('launched');
  });

  it('logs a status-level error message while polling', async () => {
    let polls = 0;
    backend.status.callsFake((cb) => {
      polls += 1;
      cb(null, polls < 2 ? { error: true, message: 'owner_unavailable' } : { ready: true, operation: op('succeeded') });
    });
    const done = run();
    await clock.tickAsync(20000);
    await done;
    expect(logger.warn.getCalls().some((c) => String(c.args[0]).includes('owner_unavailable'))).to.equal(true);
  });

  it('ends recovery_migrate_failed for a failed operation without a reason', async () => {
    backend.submit.callsFake((cb) => cb(null, { error: false, existing: true, operation: op('failed') }));
    const { err } = await run();
    expect(err.message).to.equal('recovery_migrate_failed');
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
    backend.status.onSecondCall().callsFake((cb) => cb(new Error('timeout')));
    backend.status.onThirdCall().callsFake((cb) => cb(null, { ready: true, operation: op('succeeded') }));
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
    // Only the pre-submit relaunch check, no polling.
    expect(backend.status.callCount).to.equal(1);
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
    // The relaunch check plus 6 polls.
    expect(backend.status.callCount).to.equal(7);
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
    // Neither run finds an owner operation on its relaunch check.
    backend.status.onSecondCall().callsFake((cb) => cb(null, { ready: true }));
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
    // Second run admitted, so one poll chain: one status call per interval
    // after the two relaunch checks.
    await clock.tickAsync(30000);
    expect(backend.status.callCount).to.equal(5);
    migrate.stop();
    await second;
  });
});
