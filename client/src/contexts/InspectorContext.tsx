/**
 * InspectorContext — Slice 08
 *
 * Manages the inspector selection state across the Impact Deck.
 * Any table row (Top Talkers, Detections, Alerts) can call `select()` to
 * push an entity into the inspector. The InspectorShell reads the selection
 * and routes to the appropriate detail view.
 *
 * CONTRACT:
 *   - Uses InspectorSelection from shared/cockpit-types.ts (never local types)
 *   - Only one entity selected at a time
 *   - select() auto-opens the inspector panel
 *   - clear() closes the inspector and removes the selection
 *   - Closing the inspector via X button calls clear()
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { InspectorSelection, TopTalkerRow, NormalizedDetection, NormalizedAlert } from '../../../shared/cockpit-types';

export interface InspectorContextValue {
  /** Currently selected entity, or null if nothing is selected */
  selection: InspectorSelection | null;
  /** Whether the inspector panel is open */
  isOpen: boolean;
  /** Select a device (from Top Talkers row click) — auto-opens inspector */
  selectDevice: (row: TopTalkerRow) => void;
  /** Select a detection (from Detections row click) — auto-opens inspector */
  selectDetection: (detection: NormalizedDetection) => void;
  /** Select an alert (from Alerts card click) — auto-opens inspector */
  selectAlert: (alert: NormalizedAlert) => void;
  /** Clear selection and close inspector */
  clear: () => void;
  /** Toggle inspector open/close without changing selection */
  toggle: () => void;
}

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectDevice = useCallback((row: TopTalkerRow) => {
    setSelection({ kind: 'device', device: row.device, topTalkerRow: row });
    setIsOpen(true);
  }, []);

  const selectDetection = useCallback((detection: NormalizedDetection) => {
    setSelection({ kind: 'detection', detection });
    setIsOpen(true);
  }, []);

  const selectAlert = useCallback((alert: NormalizedAlert) => {
    setSelection({ kind: 'alert', alert });
    setIsOpen(true);
  }, []);

  const clear = useCallback(() => {
    setSelection(null);
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <InspectorContext.Provider
      value={{ selection, isOpen, selectDevice, selectDetection, selectAlert, clear, toggle }}
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
