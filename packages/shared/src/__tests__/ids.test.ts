import { describe, it, expect } from 'vitest';
import { workflowId, runId, stepId, nodeId, eventId } from '../ids.js';

describe('ID generation', () => {
  it('generates workflow IDs with correct prefix', () => {
    const id = workflowId();
    expect(id).toMatch(/^wf_/);
    expect(id.length).toBeGreaterThan(4);
  });

  it('generates run IDs with correct prefix', () => {
    const id = runId();
    expect(id).toMatch(/^run_/);
  });

  it('generates step IDs with correct prefix', () => {
    const id = stepId();
    expect(id).toMatch(/^stp_/);
  });

  it('generates node IDs with correct prefix', () => {
    const id = nodeId();
    expect(id).toMatch(/^nd_/);
  });

  it('generates event IDs with correct prefix', () => {
    const id = eventId();
    expect(id).toMatch(/^evt_/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => runId()));
    expect(ids.size).toBe(1000);
  });
});
