/**
 * Drizzle ORM Relations (audit A4)
 *
 * Defines the logical relationships between dimension, bridge, fact, and snap tables.
 * These relations enable Drizzle's relational query API (db.query.*.findMany({ with: ... })).
 * They do NOT create database-level foreign keys — those are intentionally omitted
 * because the ETL process uses upsert patterns that would conflict with FK constraints.
 */
import { relations } from "drizzle-orm";
import {
  dimDevice,
  dimAlert,
  dimAppliance,
  dimNetwork,
  dimDeviceGroup,
  dimApplication,
  dimTag,
  bridgeDeviceTag,
  bridgeDeviceDeviceGroup,
  bridgeAlertDevice,
  bridgeAlertDeviceGroup,
  bridgeAlertApplication,
  bridgeAlertNetwork,
  snapDeviceIpaddr,
  snapDeviceDnsname,
  snapDeviceSoftware,
  factDeviceActivity,
  factMetricResponse,
  factMetricStat,
  factRecordSearch,
  factRecord,
  snapTopology,
  snapTopologyNode,
  snapTopologyEdge,
} from "./schema";

/* ─────────────────────────── Dimension → Bridge/Fact/Snap ─────────────────────────── */

export const dimDeviceRelations = relations(dimDevice, ({ many }) => ({
  tags: many(bridgeDeviceTag),
  deviceGroups: many(bridgeDeviceDeviceGroup),
  alertLinks: many(bridgeAlertDevice),
  ipAddresses: many(snapDeviceIpaddr),
  dnsNames: many(snapDeviceDnsname),
  software: many(snapDeviceSoftware),
  activity: many(factDeviceActivity),
}));

export const dimAlertRelations = relations(dimAlert, ({ many }) => ({
  deviceLinks: many(bridgeAlertDevice),
  deviceGroupLinks: many(bridgeAlertDeviceGroup),
  applicationLinks: many(bridgeAlertApplication),
  networkLinks: many(bridgeAlertNetwork),
}));

export const dimTagRelations = relations(dimTag, ({ many }) => ({
  deviceLinks: many(bridgeDeviceTag),
}));

export const dimDeviceGroupRelations = relations(dimDeviceGroup, ({ many }) => ({
  deviceLinks: many(bridgeDeviceDeviceGroup),
  alertLinks: many(bridgeAlertDeviceGroup),
}));

export const dimApplicationRelations = relations(dimApplication, ({ many }) => ({
  alertLinks: many(bridgeAlertApplication),
}));

export const dimNetworkRelations = relations(dimNetwork, ({ many }) => ({
  alertLinks: many(bridgeAlertNetwork),
}));

/* ─────────────────────────── Bridge → Dimension ─────────────────────────── */

export const bridgeDeviceTagRelations = relations(bridgeDeviceTag, ({ one }) => ({
  device: one(dimDevice, { fields: [bridgeDeviceTag.deviceId], references: [dimDevice.id] }),
  tag: one(dimTag, { fields: [bridgeDeviceTag.tagId], references: [dimTag.id] }),
}));

export const bridgeDeviceDeviceGroupRelations = relations(bridgeDeviceDeviceGroup, ({ one }) => ({
  device: one(dimDevice, { fields: [bridgeDeviceDeviceGroup.deviceId], references: [dimDevice.id] }),
  deviceGroup: one(dimDeviceGroup, { fields: [bridgeDeviceDeviceGroup.deviceGroupId], references: [dimDeviceGroup.id] }),
}));

export const bridgeAlertDeviceRelations = relations(bridgeAlertDevice, ({ one }) => ({
  alert: one(dimAlert, { fields: [bridgeAlertDevice.alertId], references: [dimAlert.id] }),
  device: one(dimDevice, { fields: [bridgeAlertDevice.deviceId], references: [dimDevice.id] }),
}));

export const bridgeAlertDeviceGroupRelations = relations(bridgeAlertDeviceGroup, ({ one }) => ({
  alert: one(dimAlert, { fields: [bridgeAlertDeviceGroup.alertId], references: [dimAlert.id] }),
  deviceGroup: one(dimDeviceGroup, { fields: [bridgeAlertDeviceGroup.deviceGroupId], references: [dimDeviceGroup.id] }),
}));

export const bridgeAlertApplicationRelations = relations(bridgeAlertApplication, ({ one }) => ({
  alert: one(dimAlert, { fields: [bridgeAlertApplication.alertId], references: [dimAlert.id] }),
  application: one(dimApplication, { fields: [bridgeAlertApplication.applicationId], references: [dimApplication.id] }),
}));

export const bridgeAlertNetworkRelations = relations(bridgeAlertNetwork, ({ one }) => ({
  alert: one(dimAlert, { fields: [bridgeAlertNetwork.alertId], references: [dimAlert.id] }),
  network: one(dimNetwork, { fields: [bridgeAlertNetwork.networkId], references: [dimNetwork.id] }),
}));

/* ─────────────────────────── Snap → Dimension ─────────────────────────── */

export const snapDeviceIpaddrRelations = relations(snapDeviceIpaddr, ({ one }) => ({
  device: one(dimDevice, { fields: [snapDeviceIpaddr.deviceId], references: [dimDevice.id] }),
}));

export const snapDeviceDnsnameRelations = relations(snapDeviceDnsname, ({ one }) => ({
  device: one(dimDevice, { fields: [snapDeviceDnsname.deviceId], references: [dimDevice.id] }),
}));

export const snapDeviceSoftwareRelations = relations(snapDeviceSoftware, ({ one }) => ({
  device: one(dimDevice, { fields: [snapDeviceSoftware.deviceId], references: [dimDevice.id] }),
}));

/* ─────────────────────────── Fact → Dimension ─────────────────────────── */

export const factDeviceActivityRelations = relations(factDeviceActivity, ({ one }) => ({
  device: one(dimDevice, { fields: [factDeviceActivity.deviceId], references: [dimDevice.id] }),
}));

export const factMetricResponseRelations = relations(factMetricResponse, ({ many }) => ({
  stats: many(factMetricStat),
}));

export const factMetricStatRelations = relations(factMetricStat, ({ one }) => ({
  metricResponse: one(factMetricResponse, { fields: [factMetricStat.metricResponseId], references: [factMetricResponse.id] }),
}));

export const factRecordSearchRelations = relations(factRecordSearch, ({ many }) => ({
  records: many(factRecord),
}));

export const factRecordRelations = relations(factRecord, ({ one }) => ({
  search: one(factRecordSearch, { fields: [factRecord.searchId], references: [factRecordSearch.id] }),
}));

/* ─────────────────────────── Topology Snap ─────────────────────────── */

export const snapTopologyRelations = relations(snapTopology, ({ many }) => ({
  nodes: many(snapTopologyNode),
  edges: many(snapTopologyEdge),
}));

export const snapTopologyNodeRelations = relations(snapTopologyNode, ({ one }) => ({
  topology: one(snapTopology, { fields: [snapTopologyNode.topologyId], references: [snapTopology.id] }),
}));

export const snapTopologyEdgeRelations = relations(snapTopologyEdge, ({ one }) => ({
  topology: one(snapTopology, { fields: [snapTopologyEdge.topologyId], references: [snapTopology.id] }),
}));
