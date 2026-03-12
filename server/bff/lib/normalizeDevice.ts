// server/bff/lib/normalizeDevice.ts
import type { DeviceIdentity } from '../../../shared/impact-types';
import { epochToIsoSafe } from './timeWindow';

/**
 * Normalize a raw ExtraHop device record (43+ fields) into a clean DeviceIdentity.
 *
 * displayName priority:
 * custom_name > dhcp_name > dns_name > cdp_name > netbios_name > default_name > ipaddr4 > macaddr > Device ${id}
 */
export function normalizeDevice(raw: any): DeviceIdentity {
  if (!raw || typeof raw !== 'object') {
    throw new Error('normalizeDevice received non-object input');
  }

  return {
    id: raw.id,
    displayName: resolveDisplayName(raw),
    extrahopId: coalesceString(raw.extrahop_id) || `eh-${raw.id}`,
    discoveryId: coalesceString(raw.discovery_id) || '',
    ipaddr4: coalesceString(raw.ipaddr4),
    ipaddr6: coalesceString(raw.ipaddr6),
    macaddr: raw.macaddr || '00:00:00:00:00:00',
    deviceClass: coalesceString(raw.device_class),
    role: coalesceString(raw.role),
    autoRole: coalesceString(raw.auto_role),
    vendor: coalesceString(raw.vendor),
    isL3: Boolean(raw.is_l3),
    vlanid: raw.vlanid != null ? Number(raw.vlanid) : null,
    parentId: raw.parent_id != null ? Number(raw.parent_id) : null,
    nodeId: raw.node_id != null ? Number(raw.node_id) : null,
    analysis: coalesceString(raw.analysis),
    analysisLevel: raw.analysis_level != null ? Number(raw.analysis_level) : null,
    lastSeenTime: raw.last_seen_time != null ? Number(raw.last_seen_time) : null,
    lastSeenIso: epochToIsoSafe(raw.last_seen_time),
    modTime: raw.mod_time != null ? Number(raw.mod_time) : null,
    discoverTime: raw.discover_time != null ? Number(raw.discover_time) : null,
    discoverTimeIso: epochToIsoSafe(raw.discover_time),
    onWatchlist: Boolean(raw.on_watchlist),
    critical: Boolean(raw.critical),
    customCriticality: coalesceString(raw.custom_criticality),
    isCustomDevice: false,
    customType: coalesceString(raw.custom_type),
    userModTime: raw.user_mod_time != null ? Number(raw.user_mod_time) : null,
    description: coalesceString(raw.description),
    cdp_name: coalesceString(raw.cdp_name),
    dhcp_name: coalesceString(raw.dhcp_name),
    dns_name: coalesceString(raw.dns_name),
    netbios_name: coalesceString(raw.netbios_name),
    custom_name: coalesceString(raw.custom_name),
    default_name: coalesceString(raw.default_name),
    model: coalesceString(raw.model),
    modelOverride: coalesceString(raw.model_override),
    software: coalesceString(raw.software),
  };
}

function resolveDisplayName(raw: any): string {
  return (
    coalesceString(raw.display_name) ||
    coalesceString(raw.custom_name) ||
    coalesceString(raw.dhcp_name) ||
    coalesceString(raw.dns_name) ||
    coalesceString(raw.cdp_name) ||
    coalesceString(raw.netbios_name) ||
    coalesceString(raw.default_name) ||
    coalesceString(raw.ipaddr4) ||
    coalesceString(raw.ipaddr6) ||
    raw.macaddr ||
    `Device ${raw.id}`
  );
}

function coalesceString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none') return null;
  return trimmed;
}
