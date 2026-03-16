import {
  bigint,
  boolean,
  char,
  datetime,
  double,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";

/* ─────────────────────────── Users (kept for framework) ─────────────────────────── */

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* ─────────────────────────── Raw Layer ─────────────────────────── */

export const rawApiResponse = mysqlTable("raw_api_response", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  captureTime: datetime("capture_time", { fsp: 3 }).notNull(),
  captureEpochMs: bigint("capture_epoch_ms", { mode: "number" }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  requestBody: json("request_body"),
  httpStatus: smallint("http_status").notNull(),
  responseBody: text("response_body").notNull(),
  responseHash: char("response_hash", { length: 64 }),
  ehHost: varchar("eh_host", { length: 255 }).notNull(),
  endpointName: varchar("endpoint_name", { length: 100 }).notNull(),
});

/* ─────────────────────────── Dimension Tables ─────────────────────────── */

export const dimAppliance = mysqlTable("dim_appliance", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  uuid: char("uuid", { length: 36 }).notNull().unique(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  firmwareVersion: varchar("firmware_version", { length: 50 }).notNull(),
  licenseStatus: varchar("license_status", { length: 50 }).notNull(),
  licensePlatform: varchar("license_platform", { length: 50 }),
  licensedFeatures: json("licensed_features").notNull(),
  licensedModules: json("licensed_modules").notNull(),
  enabledIntegrations: json("enabled_integrations").notNull(),
  productModules: json("product_modules").notNull(),
  statusMessage: varchar("status_message", { length: 255 }).notNull().default(""),
  connectionType: varchar("connection_type", { length: 20 }).notNull().default("direct"),
  managesLocal: boolean("manages_local").notNull(),
  managedByLocal: boolean("managed_by_local").notNull(),
  dataAccess: boolean("data_access").notNull(),
  fingerprint: varchar("fingerprint", { length: 200 }),
  totalCapacity: int("total_capacity"),
  advancedAnalysisCapacity: int("advanced_analysis_capacity"),
  addTime: bigint("add_time", { mode: "number" }),
  syncTime: bigint("sync_time", { mode: "number" }).notNull().default(0),
  analysisLevelsManaged: boolean("analysis_levels_managed").notNull(),
  nickname: varchar("nickname", { length: 255 }).notNull().default(""),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimNetwork = mysqlTable("dim_network", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  nodeId: int("node_id"),
  applianceUuid: varchar("appliance_uuid", { length: 36 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  idle: boolean("idle").notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimDevice = mysqlTable("dim_device", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  extrahopId: varchar("extrahop_id", { length: 50 }).notNull(),
  discoveryId: varchar("discovery_id", { length: 50 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  defaultName: varchar("default_name", { length: 255 }).notNull(),
  customName: varchar("custom_name", { length: 255 }),
  description: text("description"),
  macaddr: char("macaddr", { length: 17 }).notNull(),
  ipaddr4: varchar("ipaddr4", { length: 15 }),
  ipaddr6: varchar("ipaddr6", { length: 45 }),
  deviceClass: varchar("device_class", { length: 20 }).notNull(),
  vendor: varchar("vendor", { length: 255 }),
  isL3: boolean("is_l3").notNull(),
  vlanid: int("vlanid").notNull().default(0),
  parentId: int("parent_id"),
  nodeId: int("node_id"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  userModTime: bigint("user_mod_time", { mode: "number" }).notNull(),
  discoverTime: bigint("discover_time", { mode: "number" }).notNull(),
  lastSeenTime: bigint("last_seen_time", { mode: "number" }),
  autoRole: varchar("auto_role", { length: 50 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  analysisLevel: tinyint("analysis_level").notNull(),
  analysis: varchar("analysis", { length: 20 }).notNull(),
  onWatchlist: boolean("on_watchlist").notNull().default(false),
  critical: boolean("critical").notNull().default(false),
  customCriticality: varchar("custom_criticality", { length: 50 }),
  model: varchar("model", { length: 255 }),
  modelOverride: varchar("model_override", { length: 255 }),
  customMake: varchar("custom_make", { length: 255 }),
  customModel: varchar("custom_model", { length: 255 }),
  customType: varchar("custom_type", { length: 50 }).notNull().default(""),
  cdpName: varchar("cdp_name", { length: 255 }).notNull().default(""),
  dhcpName: varchar("dhcp_name", { length: 255 }).notNull().default(""),
  netbiosName: varchar("netbios_name", { length: 255 }).notNull().default(""),
  dnsName: varchar("dns_name", { length: 255 }).notNull().default(""),
  cloudInstanceId: varchar("cloud_instance_id", { length: 255 }),
  cloudInstanceType: varchar("cloud_instance_type", { length: 255 }),
  cloudInstanceDescription: text("cloud_instance_description"),
  cloudInstanceName: varchar("cloud_instance_name", { length: 255 }),
  cloudAccount: varchar("cloud_account", { length: 255 }),
  vpcId: varchar("vpc_id", { length: 255 }),
  subnetId: varchar("subnet_id", { length: 255 }),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimDeviceGroup = mysqlTable("dim_device_group", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  builtIn: boolean("built_in").notNull(),
  includeCustomDevices: boolean("include_custom_devices").notNull(),
  dynamic: boolean("dynamic").notNull(),
  field: varchar("field", { length: 100 }),
  value: varchar("value", { length: 255 }),
  filter: json("filter"),
  editors: json("editors"),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimVlan = mysqlTable("dim_vlan", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  vlanid: int("vlanid").notNull(),
  networkId: int("network_id").notNull(),
  nodeId: int("node_id"),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimAlert = mysqlTable("dim_alert", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  author: varchar("author", { length: 100 }).notNull(),
  description: text("description"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  severity: tinyint("severity").notNull(),
  disabled: boolean("disabled").notNull(),
  statName: varchar("stat_name", { length: 255 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  fieldName2: varchar("field_name2", { length: 100 }),
  fieldOp: varchar("field_op", { length: 10 }),
  operator: varchar("operator", { length: 10 }).notNull(),
  operand: varchar("operand", { length: 100 }).notNull(),
  units: varchar("units", { length: 20 }).notNull().default("none"),
  intervalLength: int("interval_length").notNull(),
  refireInterval: int("refire_interval").notNull(),
  notifySnmp: boolean("notify_snmp").notNull().default(false),
  applyAll: boolean("apply_all").notNull().default(false),
  param: json("param").notNull(),
  param2: json("param2").notNull(),
  cc: json("cc").notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimTag = mysqlTable("dim_tag", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimApplication = mysqlTable("dim_application", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  extrahopId: varchar("extrahop_id", { length: 255 }).notNull(),
  discoveryId: varchar("discovery_id", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  criteria: json("criteria"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  userModTime: bigint("user_mod_time", { mode: "number" }).notNull(),
  nodeId: int("node_id"),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimNetworkLocality = mysqlTable("dim_network_locality", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }).notNull().default(""),
  external: boolean("external").notNull(),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  network: varchar("network", { length: 50 }).notNull(),
  networks: json("networks").notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimActivityMap = mysqlTable("dim_activity_map", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  mode: varchar("mode", { length: 20 }),
  showAlertStatus: boolean("show_alert_status"),
  weighting: varchar("weighting", { length: 20 }),
  shortCode: varchar("short_code", { length: 50 }),
  walks: json("walks"),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimDetectionFormat = mysqlTable("dim_detection_format", {
  type: varchar("type", { length: 255 }).primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  displayName: varchar("display_name", { length: 500 }),
  author: varchar("author", { length: 255 }),
  categories: json("categories"),
  isUserCreated: boolean("is_user_created"),
  mitreCategories: json("mitre_categories"),
  properties: json("properties"),
  status: varchar("status", { length: 50 }),
  released: bigint("released", { mode: "number" }),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const dimDetection = mysqlTable("dim_detection", {
  id: int("id").primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  applianceId: int("appliance_id"),
  assignee: varchar("assignee", { length: 255 }),
  categories: json("categories"),
  createTime: bigint("create_time", { mode: "number" }).notNull(),
  description: text("description"),
  endTime: bigint("end_time", { mode: "number" }),
  isUserCreated: boolean("is_user_created").notNull().default(false),
  mitreTactics: json("mitre_tactics"),
  mitreTechniques: json("mitre_techniques"),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  participants: json("participants"),
  properties: json("properties"),
  recommended: boolean("recommended"),
  recommendedFactors: json("recommended_factors"),
  resolution: varchar("resolution", { length: 50 }),
  riskScore: int("risk_score"),
  startTime: bigint("start_time", { mode: "number" }).notNull(),
  status: varchar("status", { length: 50 }),
  ticketId: varchar("ticket_id", { length: 255 }),
  ticketUrl: varchar("ticket_url", { length: 2048 }),
  title: varchar("title", { length: 500 }).notNull(),
  type: varchar("type", { length: 255 }).notNull(),
  url: varchar("url", { length: 2048 }),
  updateTime: bigint("update_time", { mode: "number" }),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

/* ─────────────────────────── Bridge Tables ─────────────────────────── */

export const bridgeDeviceTag = mysqlTable("bridge_device_tag", {
  deviceId: int("device_id").notNull(),
  tagId: int("tag_id").notNull(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  observedAt: datetime("observed_at", { fsp: 3 }).notNull(),
}, (table) => [primaryKey({ columns: [table.deviceId, table.tagId] })]);

export const bridgeDeviceDeviceGroup = mysqlTable("bridge_device_device_group", {
  deviceId: int("device_id").notNull(),
  deviceGroupId: int("device_group_id").notNull(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  observedAt: datetime("observed_at", { fsp: 3 }).notNull(),
}, (table) => [primaryKey({ columns: [table.deviceId, table.deviceGroupId] })]);

export const bridgeAlertApplication = mysqlTable("bridge_alert_application", {
  alertId: int("alert_id").notNull(),
  applicationId: int("application_id").notNull(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  observedAt: datetime("observed_at", { fsp: 3 }).notNull(),
}, (table) => [primaryKey({ columns: [table.alertId, table.applicationId] })]);

export const bridgeAlertDevice = mysqlTable("bridge_alert_device", {
  alertId: int("alert_id").notNull(),
  deviceId: int("device_id").notNull(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  observedAt: datetime("observed_at", { fsp: 3 }).notNull(),
}, (table) => [primaryKey({ columns: [table.alertId, table.deviceId] })]);

export const bridgeAlertDeviceGroup = mysqlTable("bridge_alert_device_group", {
  alertId: int("alert_id").notNull(),
  deviceGroupId: int("device_group_id").notNull(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  observedAt: datetime("observed_at", { fsp: 3 }).notNull(),
}, (table) => [primaryKey({ columns: [table.alertId, table.deviceGroupId] })]);

export const bridgeAlertNetwork = mysqlTable("bridge_alert_network", {
  alertId: int("alert_id").notNull(),
  networkId: int("network_id").notNull(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  observedAt: datetime("observed_at", { fsp: 3 }).notNull(),
}, (table) => [primaryKey({ columns: [table.alertId, table.networkId] })]);

/* ─────────────────────────── Fact Tables ─────────────────────────── */

export const factMetricResponse = mysqlTable("fact_metric_response", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  cycle: varchar("cycle", { length: 10 }).notNull(),
  nodeId: int("node_id").notNull(),
  clock: bigint("clock", { mode: "number" }).notNull(),
  fromTime: bigint("from_time", { mode: "number" }).notNull(),
  untilTime: bigint("until_time", { mode: "number" }).notNull(),
  metricCategory: varchar("metric_category", { length: 100 }).notNull(),
  objectType: varchar("object_type", { length: 20 }).notNull(),
  requestBody: json("request_body").notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const factMetricStat = mysqlTable("fact_metric_stat", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  metricResponseId: bigint("metric_response_id", { mode: "number", unsigned: true }).notNull(),
  oid: int("oid").notNull(),
  statTime: bigint("stat_time", { mode: "number" }).notNull(),
  duration: int("duration").notNull(),
  valuesJson: json("values_json").notNull(),
});

export const factRecordSearch = mysqlTable("fact_record_search", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  fromTime: bigint("from_time", { mode: "number" }).notNull(),
  untilTime: bigint("until_time", { mode: "number" }).notNull(),
  total: int("total").notNull(),
  terminatedEarly: boolean("terminated_early").notNull().default(false),
  lookbackTruncated: boolean("lookback_truncated").notNull().default(false),
  lookbackExceeded: boolean("lookback_exceeded").notNull().default(false),
  requestBody: json("request_body").notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const factRecord = mysqlTable("fact_record", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  searchId: bigint("search_id", { mode: "number", unsigned: true }).notNull(),
  recordId: varchar("record_id", { length: 100 }).notNull(),
  recordType: varchar("record_type", { length: 50 }).notNull(),
  applianceUuid: varchar("appliance_uuid", { length: 50 }).notNull(),
  sourceJson: json("source_json").notNull(),
});

export const factDeviceActivity = mysqlTable("fact_device_activity", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  activityId: bigint("activity_id", { mode: "number" }).notNull().unique(),
  deviceId: int("device_id").notNull(),
  fromTime: bigint("from_time", { mode: "number" }).notNull(),
  untilTime: bigint("until_time", { mode: "number" }).notNull(),
  modTime: bigint("mod_time", { mode: "number" }).notNull(),
  statName: varchar("stat_name", { length: 255 }).notNull(),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

/* ─────────────────────────── Snapshot Tables ─────────────────────────── */

export const snapDeviceIpaddr = mysqlTable("snap_device_ipaddr", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  deviceId: int("device_id").notNull(),
  ipaddr: varchar("ipaddr", { length: 45 }).notNull(),
  lastObservationTime: bigint("last_observation_time", { mode: "number" }),
  isCurrent: boolean("is_current").notNull().default(true),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const snapDeviceDnsname = mysqlTable("snap_device_dnsname", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  deviceId: int("device_id").notNull(),
  dnsName: varchar("dns_name", { length: 255 }).notNull(),
  isCurrent: boolean("is_current").notNull().default(true),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const snapDeviceSoftware = mysqlTable("snap_device_software", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  deviceId: int("device_id").notNull(),
  softwareJson: json("software_json").notNull(),
  isCurrent: boolean("is_current").notNull().default(true),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

/* ─────────────────────────── Topology Tables ─────────────────────────── */

export const snapTopology = mysqlTable("snap_topology", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawId: bigint("raw_id", { mode: "number", unsigned: true }).notNull(),
  activityMapId: int("activity_map_id"),
  fromTime: bigint("from_time", { mode: "number" }).notNull(),
  untilTime: bigint("until_time", { mode: "number" }).notNull(),
  nodeCount: int("node_count").notNull().default(0),
  edgeCount: int("edge_count").notNull().default(0),
  polledAt: datetime("polled_at", { fsp: 3 }).notNull(),
});

export const snapTopologyNode = mysqlTable("snap_topology_node", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  topologyId: bigint("topology_id", { mode: "number", unsigned: true }).notNull(),
  objectType: varchar("object_type", { length: 20 }).notNull(),
  objectId: int("object_id"),
  ipaddr: varchar("ipaddr", { length: 45 }),
  displayName: varchar("display_name", { length: 255 }),
  role: varchar("role", { length: 50 }),
  isExternal: boolean("is_external").notNull().default(false),
  weight: bigint("weight", { mode: "number" }).notNull().default(0),
  nodeData: json("node_data"),
});

export const snapTopologyEdge = mysqlTable("snap_topology_edge", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  topologyId: bigint("topology_id", { mode: "number", unsigned: true }).notNull(),
  sourceNodeId: bigint("source_node_id", { mode: "number", unsigned: true }),
  targetNodeId: bigint("target_node_id", { mode: "number", unsigned: true }),
  protocol: varchar("protocol", { length: 50 }),
  weight: bigint("weight", { mode: "number" }).notNull().default(0),
  bytesIn: bigint("bytes_in", { mode: "number" }).notNull().default(0),
  bytesOut: bigint("bytes_out", { mode: "number" }).notNull().default(0),
  edgeData: json("edge_data"),
});

/* ─────────────────────────── Appliance Configuration (Slice 14) ─────────────────────────── */

export const applianceConfig = mysqlTable("appliance_config", {
  id: int("id").autoincrement().primaryKey(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  apiKey: varchar("api_key", { length: 512 }).notNull(),
  verifySsl: boolean("verify_ssl").notNull().default(true),
  cloudServicesEnabled: boolean("cloud_services_enabled").notNull().default(false),
  nickname: varchar("nickname", { length: 100 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestResult: mysqlEnum("last_test_result", ["success", "failure", "untested"]).notNull().default("untested"),
  lastTestMessage: varchar("last_test_message", { length: 1000 }).notNull().default(""),
});

export type ApplianceConfigRow = typeof applianceConfig.$inferSelect;
export type InsertApplianceConfigRow = typeof applianceConfig.$inferInsert;

/* ─────────────────────────── Schema Management ─────────────────────────── */

export const schemaVersion = mysqlTable("schema_version", {
  id: int("id", { unsigned: true }).autoincrement().primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull().unique(),
  checksum: char("checksum", { length: 64 }).notNull(),
  appliedAt: datetime("applied_at", { fsp: 3 }).notNull(),
  appliedBy: varchar("applied_by", { length: 100 }),
});

export const schemaDriftLog = mysqlTable("schema_drift_log", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  runAt: datetime("run_at", { fsp: 3 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("live"),
  endpointsTested: int("endpoints_tested").notNull().default(0),
  objectsValidated: int("objects_validated").notNull().default(0),
  totalIssues: int("total_issues").notNull().default(0),
  exitCode: tinyint("exit_code").notNull().default(0),
  reportJson: json("report_json"),
});

/* ─────────────────────────── Saved Topology Views (Slice 35E) ─────────────────────────── */

export const savedTopologyViews = mysqlTable("saved_topology_views", {
  id: int("id", { unsigned: true }).autoincrement().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  viewMode: varchar("view_mode", { length: 20 }).notNull().default("constellation"),
  zoom: double("zoom").notNull().default(1),
  panX: double("pan_x").notNull().default(0),
  panY: double("pan_y").notNull().default(0),
  collapsedSubnets: json("collapsed_subnets").$type<string[]>().notNull(),
  roleFilters: json("role_filters").$type<string[]>().notNull(),
  protocolFilters: json("protocol_filters").$type<string[]>().notNull(),
  anomalyOverlayEnabled: boolean("anomaly_overlay_enabled").notNull().default(false),
  anomalyThreshold: double("anomaly_threshold").notNull().default(50),
  criticalPathSource: int("critical_path_source"),
  criticalPathDestination: int("critical_path_destination"),
  searchTerm: varchar("search_term", { length: 255 }).notNull().default(""),
  nodePositions: json("node_positions").$type<Record<string, { x: number; y: number }> | null>().default(null),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SavedTopologyViewRow = typeof savedTopologyViews.$inferSelect;
export type InsertSavedTopologyViewRow = typeof savedTopologyViews.$inferInsert;
