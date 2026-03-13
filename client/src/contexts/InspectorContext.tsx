/**
 * InspectorContext — Slice 08 + Slice 12 + Slice 13
 *
 * Manages the inspector selection state across the Impact Deck.
 * Any table row (Top Talkers, Detections, Alerts) can call `select()` to
 * push an entity into the inspector. The InspectorShell reads the selection
 * and routes to the appropriate detail view.
 *
 * Slice 13 additions:
 *   - Navigation history stack (InspectorHistoryEntry[])
 *   - goBack() pops the last entry and navigates to it
 *   - goToIndex(i) navigates to a specific breadcrumb position
 *   - Every select* call pushes the CURRENT selection onto the stack
 *     before replacing it with the new selection
 *   - clear() resets both selection and history
 *   - History is capped at INSPECTOR_HISTORY_MAX_DEPTH entries
 *
 * CONTRACT:
 *   - Uses InspectorSelection from shared/cockpit-types.ts (never local types)
 *   - Only one entity selected at a time
 *   - select() auto-opens the inspector panel
 *   - clear() closes the inspector, removes the selection, AND clears history
 *   - Closing the inspector via X button calls clear()
 *   - History stack uses pure functions from shared/inspector-history.ts
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  InspectorSelection,
  InspectorHistoryEntry,
  TopTalkerRow,
  NormalizedDetection,
  NormalizedAlert,
  DeviceIdentity,
} from '../../../shared/cockpit-types';
import { pushHistory, goBackInHistory, goToHistoryIndex } from '../../../shared/inspector-history';

export interface InspectorContextValue {
  /** Currently selected entity, or null if nothing is selected */
  selection: InspectorSelection | null;
  /** Whether the inspector panel is open */
  isOpen: boolean;
  /** Navigation history stack (does NOT include current selection) */
  history: InspectorHistoryEntry[];
  /** Whether goBack is possible (history has entries) */
  canGoBack: boolean;
  /** Select a device (from Top Talkers row click) — auto-opens inspector */
  selectDevice: (row: TopTalkerRow) => void;
  /** Select a detection (from Detections row click) — auto-opens inspector */
  selectDetection: (detection: NormalizedDetection) => void;
  /** Select an alert (from Alerts card click) — auto-opens inspector */
  selectAlert: (alert: NormalizedAlert) => void;
  /** Select a device by identity only (from cross-entity navigation in detail panes) — auto-opens inspector */
  selectDeviceByIdentity: (device: DeviceIdentity) => void;
  /** Select a detection by entity (from cross-entity navigation in detail panes) — auto-opens inspector */
  selectDetectionEntity: (detection: NormalizedDetection) => void;
  /** Select an alert by entity (from cross-entity navigation in detail panes) — auto-opens inspector */
  selectAlertEntity: (alert: NormalizedAlert) => void;
  /** Go back one step in navigation history */
  goBack: () => void;
  /** Navigate to a specific breadcrumb index */
  goToIndex: (index: number) => void;
  /** Clear selection, close inspector, and reset history */
  clear: () => void;
  /** Toggle inspector open/close without changing selection */
  toggle: () => void;
}

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<InspectorHistoryEntry[]>([]);

  /**
   * Internal helper: push current selection onto history, then set new selection.
   * If current selection is null (first selection), no history entry is created.
   */
  const navigateTo = useCallback((newSelection: InspectorSelection) => {
    setSelection((prev) => {
      if (prev) {
        setHistory((h) => pushHistory(h, prev));
      }
      return newSelection;
    });
    setIsOpen(true);
  }, []);

  const selectDevice = useCallback((row: TopTalkerRow) => {
    navigateTo({ kind: 'device', device: row.device, topTalkerRow: row });
  }, [navigateTo]);

  const selectDetection = useCallback((detection: NormalizedDetection) => {
    navigateTo({ kind: 'detection', detection });
  }, [navigateTo]);

  const selectAlert = useCallback((alert: NormalizedAlert) => {
    navigateTo({ kind: 'alert', alert });
  }, [navigateTo]);

  const selectDeviceByIdentity = useCallback((device: DeviceIdentity) => {
    const shellRow: TopTalkerRow = {
      device,
      bytesIn: 0,
      bytesOut: 0,
      totalBytes: 0,
      pktsIn: 0,
      pktsOut: 0,
      sparkline: [],
    };
    navigateTo({ kind: 'device', device, topTalkerRow: shellRow });
  }, [navigateTo]);

  const selectDetectionEntity = useCallback((detection: NormalizedDetection) => {
    navigateTo({ kind: 'detection', detection });
  }, [navigateTo]);

  const selectAlertEntity = useCallback((alert: NormalizedAlert) => {
    navigateTo({ kind: 'alert', alert });
  }, [navigateTo]);

  const goBack = useCallback(() => {
    setHistory((h) => {
      const result = goBackInHistory(h);
      if (result.selection) {
        setSelection(result.selection);
        // Keep inspector open
      }
      return result.stack;
    });
  }, []);

  const goToIndex = useCallback((index: number) => {
    setHistory((h) => {
      const result = goToHistoryIndex(h, index);
      if (result.selection) {
        setSelection(result.selection);
        // Keep inspector open
      }
      return result.stack;
    });
  }, []);

  const clear = useCallback(() => {
    setSelection(null);
    setIsOpen(false);
    setHistory([]);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <InspectorContext.Provider
      value={{
        selection,
        isOpen,
        history,
        canGoBack: history.length > 0,
        selectDevice,
        selectDetection,
        selectAlert,
        selectDeviceByIdentity,
        selectDetectionEntity,
        selectAlertEntity,
        goBack,
        goToIndex,
        clear,
        toggle,
      }}
    >
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector(): InspectorContextValue {
  const ctx = useContext(InspectorContext);
  if (!ctx) {
    throw new Error('useInspector must be used within an InspectorProvider');
  }
  return ctx;
}
