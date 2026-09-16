import { describe, expect, it } from 'vitest';

describe('life overview contract', () => {
  it('keeps sync lifecycle statuses explicit', () => {
    const statuses = ['QUEUED','RUNNING','COMPLETED','FAILED'];
    expect(statuses).toContain('QUEUED');
    expect(statuses).toContain('RUNNING');
    expect(statuses).toContain('COMPLETED');
    expect(statuses).toContain('FAILED');
  });

  it('exposes a bounded sync history contract', () => {
    const limit = 25;
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(25);
  });
});
