// server/bff/lib/normalizeDetection.ts
import type { NormalizedDetection, NormalizedAlert, DetectionParticipant, Severity } from '../../../shared/impact-types';
import { epochToIso } from './timeWindow';
import { mapAlertSeverity } from '../../../shared/impact-constants';

/**
 * CRITICAL: Detection participants object_type can be 'device' OR 'ipaddr'.
 * Always check object_type before resolving.
 */
export function normalizeDetection(raw: any): NormalizedDetection {
  const participants: DetectionParticipant[] = (raw.participants || []).map((p: any) => ({
    object_type: p.object_type,
    object_id: p.object_id ?? undefined,
    ipaddr: p.ipaddr ?? undefined,
    hostname: p.hostname ?? undefined,
    role: p.role || 'unknown',
  }));

  return {
    id: raw.id,
    title: raw.title || raw.display_name || `Detection ${raw.id}`,
    type: raw.type || 'unknown',
    displayName: raw.display_name || raw.title || `Detection ${raw.id}`,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    participants,
    riskScore: raw.risk_score ?? 0,
    startTime: raw.start_time,
    startTimeIso: epochToIso(raw.start_time),
    endTime: raw.end_time,
    endTimeIso: epochToIso(raw.end_time),
    createTime: raw.create_time,
    createTimeIso: epochToIso(raw.create_time),
    status: raw.status || 'new',
    resolution: raw.resolution ?? null,
    assignee: raw.assignee ?? null,
    ticketId: raw.ticket_id ?? null,
    mitreTactics: Array.isArray(raw.mitre_tactics) ? raw.mitre_tactics : [],
    mitreTechniques: Array.isArray(raw.mitre_techniques) ? raw.mitre_techniques : [],
    isUserCreated: Boolean(raw.is_user_created),
    properties: raw.properties || {},
    url: raw.url ?? null,
  };
}

export function normalizeAlert(raw: any): NormalizedAlert {
  return {
    id: raw.id,
    name: raw.name || `Alert ${raw.id}`,
    author: raw.author || 'system',
    statName: raw.stat_name || '',
    fieldName: raw.field_name || '',
    fieldOp: raw.field_op || null,
    fieldName2: raw.field_name2 || null,
    operator: raw.operator || '',
    operand: raw.operand ?? 0,
    severity: raw.severity ?? 0,
    severityLabel: mapAlertSeverity(raw.severity ?? 0),
    type: raw.type || 'threshold',
    disabled: Boolean(raw.disabled),
    description: raw.description || '',
    intervalLength: raw.interval_length ?? null,
    refireInterval: raw.refire_interval ?? null,
  };
}

export function riskScoreToSeverity(riskScore: number): Severity {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 30) return 'medium';
  return 'low';
}
