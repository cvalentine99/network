/**
 * Inspector History — Pure helper functions (Slice 13)
 *
 * All functions are pure (no side effects, no React dependency).
 * They operate on plain arrays and InspectorSelection values.
 *
 * CONTRACT:
 *   - labelForSelection derives a human-readable breadcrumb label from any InspectorSelection
 *   - pushHistory appends a new entry and enforces INSPECTOR_HISTORY_MAX_DEPTH (FIFO eviction)
 *   - goBackInHistory pops the last entry and returns the previous selection
 *   - goToHistoryIndex truncates the stack to a specific index (breadcrumb click)
 *   - All functions return new arrays (immutable)
 *   - Empty stack is a valid state (no history)
 */
import type { InspectorSelection, InspectorHistoryEntry, EpochMs } from './cockpit-types';
import { INSPECTOR_HISTORY_MAX_DEPTH } from './cockpit-constants';

/**
 * Derive a human-readable label from an InspectorSelection.
 * Used for breadcrumb display text.
 *
 * Device  → device.displayName (truncated to 24 chars)
 * Detection → detection.title (truncated to 24 chars)
 * Alert → alert.name (truncated to 24 chars)
 */
export function labelForSelection(selection: InspectorSelection): string {
  const MAX_LABEL_LEN = 24;
  let raw: string;
  switch (selection.kind) {
    case 'device':
      raw = selection.device.displayName;
      break;
    case 'detection':
      raw = selection.detection.title;
      break;
    case 'alert':
      raw = selection.alert.name;
      break;
    default:
      raw = 'Unknown';
  }
  if (raw.length > MAX_LABEL_LEN) {
    return raw.slice(0, MAX_LABEL_LEN - 1) + '…';
  }
  return raw;
}

/**
 * Kind label for breadcrumb prefix badge.
 */
export function kindLabel(selection: InspectorSelection): string {
  switch (selection.kind) {
    case 'device': return 'Device';
    case 'detection': return 'Detection';
    case 'alert': return 'Alert';
    default: return 'Entity';
  }
}

/**
 * Push the current selection onto the history stack.
 * Returns a new stack array (immutable).
 *
 * If the stack exceeds INSPECTOR_HISTORY_MAX_DEPTH, the oldest entry is dropped.
 * If the new selection is identical to the top of the stack (same kind + same id),
 * the push is a no-op to prevent duplicate consecutive entries.
 */
export function pushHistory(
  stack: InspectorHistoryEntry[],
  selection: InspectorSelection,
  now: EpochMs = Date.now(),
): InspectorHistoryEntry[] {
  // Dedup: don't push if top of stack is the same entity
  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (isSameEntity(top.selection, selection)) {
      return stack;
    }
  }

  const entry: InspectorHistoryEntry = {
    selection,
    label: labelForSelection(selection),
    timestamp: now,
  };

  const next = [...stack, entry];

  // FIFO eviction if over max depth
  if (next.length > INSPECTOR_HISTORY_MAX_DEPTH) {
    return next.slice(next.length - INSPECTOR_HISTORY_MAX_DEPTH);
  }
  return next;
}

/**
 * Go back one step in history.
 * Returns { stack, selection } where:
 *   - stack is the new history (last entry removed)
 *   - selection is the entry that was popped (the one to navigate to),
 *     or null if the stack was empty or had only one entry
 *
 * The current selection is NOT in the stack — the stack contains
 * only previous selections. So "go back" means:
 *   1. Pop the last entry from the stack
 *   2. That entry's selection becomes the new current selection
 */
export function goBackInHistory(
  stack: InspectorHistoryEntry[],
): { stack: InspectorHistoryEntry[]; selection: InspectorSelection | null } {
  if (stack.length === 0) {
    return { stack: [], selection: null };
  }
  const newStack = stack.slice(0, -1);
  const popped = stack[stack.length - 1];
  return { stack: newStack, selection: popped.selection };
}

/**
 * Navigate to a specific breadcrumb index.
 * Truncates the stack to everything before (not including) the target index.
 * Returns the selection at the target index.
 *
 * Example: stack = [A, B, C], current = D
 *   goToHistoryIndex(stack, 1) → stack = [A], selection = B
 */
export function goToHistoryIndex(
  stack: InspectorHistoryEntry[],
  index: number,
): { stack: InspectorHistoryEntry[]; selection: InspectorSelection | null } {
  if (index < 0 || index >= stack.length) {
    return { stack, selection: null };
  }
  const target = stack[index];
  const newStack = stack.slice(0, index);
  return { stack: newStack, selection: target.selection };
}

/**
 * Check if two selections refer to the same entity.
 * Used for dedup on consecutive pushes.
 */
export function isSameEntity(a: InspectorSelection, b: InspectorSelection): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'device':
      return a.device.id === (b as Extract<InspectorSelection, { kind: 'device' }>).device.id;
    case 'detection':
      return a.detection.id === (b as Extract<InspectorSelection, { kind: 'detection' }>).detection.id;
    case 'alert':
      return a.alert.id === (b as Extract<InspectorSelection, { kind: 'alert' }>).alert.id;
    default:
      return false;
  }
}
