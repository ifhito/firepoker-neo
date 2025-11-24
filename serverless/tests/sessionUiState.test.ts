import { describe, expect, it } from 'vitest';

import type { ProductBacklogItem } from '../web/src/domain/pbi';
import { synchronizeSelection, calculateUpdateState } from '../web/src/lib/sessionUiState';

const createItem = (id: string): ProductBacklogItem => ({
  id,
  title: `PBI ${id}`,
  status: 'Ready',
  storyPoint: null,
  assignee: null,
  epic: null,
  sprint: null,
  lastEstimatedAt: null,
});

describe('synchronizeSelection', () => {
  it('picks the first item when there is no current selection', () => {
    const items = [createItem('a'), createItem('b')];
    const selection = synchronizeSelection({ point: '', memo: '' }, items);
    expect(selection.target?.id).toBe('a');
  });

  it('keeps the selection when the item still exists', () => {
    const items = [createItem('stay'), createItem('other')];
    const selection = synchronizeSelection({ target: items[0], point: '', memo: '' }, items);
    expect(selection.target?.id).toBe('stay');
  });

  it('switches to the first item when the selected one disappears', () => {
    const previous = createItem('vanish');
    const items = [createItem('new')];
    const selection = synchronizeSelection({ target: previous, point: '', memo: '' }, items);
    expect(selection.target?.id).toBe('new');
  });

  it('clears the selection when there are no items', () => {
    const selection = synchronizeSelection({ target: createItem('only'), point: '', memo: '' }, []);
    expect(selection.target).toBeUndefined();
  });
});

describe('calculateUpdateState', () => {
  const target = createItem('selected');

  it('disables updates when the socket is not connected', () => {
    const state = calculateUpdateState('connecting', { target, point: 3, memo: '' });
    expect(state.disabled).toBe(true);
    expect(state.message).toContain('接続');
  });

  it('disables updates when no target is selected', () => {
    const state = calculateUpdateState('connected', { point: '', memo: '' });
    expect(state.disabled).toBe(true);
    expect(state.message).toContain('PBI');
  });

  it('disables updates when the point is invalid', () => {
    const state = calculateUpdateState('connected', { target, point: '', memo: '' });
    expect(state.disabled).toBe(true);
    expect(state.message).toContain('ポイント');
  });

  it('allows updates when the socket is ready and input is valid', () => {
    const state = calculateUpdateState('connected', { target, point: 5, memo: '' });
    expect(state.disabled).toBe(false);
    expect(state.message).toBeNull();
  });
});
