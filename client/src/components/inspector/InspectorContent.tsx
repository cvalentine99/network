/**
 * InspectorContent — Routes inspector content based on the selected entity kind.
 *
 * Slice 08 — Interaction contract component.
 * Slice 09 — DevicePreview replaced with DeviceDetailPane.
 * Slice 11 — DetectionPreview replaced with DetectionDetailPane.
 *            AlertPreview replaced with AlertDetailPane.
 *
 * CONTRACT:
 *   - Reads InspectorSelection from InspectorContext (never raw payloads)
 *   - Routes to kind-specific detail panes:
 *     - 'device' → DeviceDetailPane (full detail with BFF fetch, Slice 09)
 *     - 'detection' → DetectionDetailPane (full detail with BFF fetch, Slice 11)
 *     - 'alert' → AlertDetailPane (full detail with BFF fetch, Slice 11)
 *   - null selection → empty state (handled by InspectorShell's default children)
 *   - No ExtraHop calls — all data comes via BFF
 *   - Uses shared types only (InspectorSelection)
 */
import type { InspectorSelection } from '../../../../shared/cockpit-types';
import { DeviceDetailPane } from './DeviceDetailPane';
import { DetectionDetailPane } from './DetectionDetailPane';
import { AlertDetailPane } from './AlertDetailPane';

// ─── Main Router ─────────────────────────────────────────────────────────
export function InspectorContent({ selection }: { selection: InspectorSelection | null }) {
  if (!selection) return null;

  switch (selection.kind) {
    case 'device':
      return <DeviceDetailPane selection={selection} />;
    case 'detection':
      return <DetectionDetailPane selection={selection} />;
    case 'alert':
      return <AlertDetailPane selection={selection} />;
    default:
      return null;
  }
}

/**
 * Returns the inspector title based on the current selection kind.
 */
export function inspectorTitle(selection: InspectorSelection | null): string {
  if (!selection) return 'Inspector';
  switch (selection.kind) {
    case 'device':
      return 'Device Inspector';
    case 'detection':
      return 'Detection Inspector';
    case 'alert':
      return 'Alert Inspector';
    default:
      return 'Inspector';
  }
}
