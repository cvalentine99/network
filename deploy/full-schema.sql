-- Full schema DDL for netperf_app
-- Generated from drizzle/schema.ts
-- Applies all tables needed for the contract-phase build

-- Users (framework)
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Raw Layer
CREATE TABLE IF NOT EXISTS `raw_api_response` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `capture_time` datetime(3) NOT NULL,
  `capture_epoch_ms` bigint NOT NULL,
  `method` varchar(10) NOT NULL,
  `url` varchar(2048) NOT NULL,
  `request_body` json,
  `http_status` smallint NOT NULL,
  `response_body` text NOT NULL,
  `response_hash` char(64),
  `eh_host` varchar(255) NOT NULL,
  `endpoint_name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Appliance
CREATE TABLE IF NOT EXISTS `dim_appliance` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `uuid` char(36) NOT NULL,
  `hostname` varchar(255) NOT NULL,
  `platform` varchar(20) NOT NULL,
  `firmware_version` varchar(50) NOT NULL,
  `license_status` varchar(50) NOT NULL,
  `license_platform` varchar(50),
  `licensed_features` json NOT NULL,
  `licensed_modules` json NOT NULL,
  `enabled_integrations` json NOT NULL,
  `product_modules` json NOT NULL,
  `status_message` varchar(255) NOT NULL DEFAULT '',
  `connection_type` varchar(20) NOT NULL DEFAULT 'direct',
  `manages_local` tinyint(1) NOT NULL,
  `managed_by_local` tinyint(1) NOT NULL,
  `data_access` tinyint(1) NOT NULL,
  `fingerprint` varchar(200),
  `total_capacity` int,
  `advanced_analysis_capacity` int,
  `add_time` bigint,
  `sync_time` bigint NOT NULL DEFAULT 0,
  `analysis_levels_managed` tinyint(1) NOT NULL,
  `nickname` varchar(255) NOT NULL DEFAULT '',
  `display_name` varchar(255) NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dim_appliance_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Network
CREATE TABLE IF NOT EXISTS `dim_network` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `node_id` int,
  `appliance_uuid` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `mod_time` bigint NOT NULL,
  `idle` tinyint(1) NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Device
CREATE TABLE IF NOT EXISTS `dim_device` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `extrahop_id` varchar(50) NOT NULL,
  `discovery_id` varchar(50) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `default_name` varchar(255) NOT NULL,
  `custom_name` varchar(255),
  `description` text,
  `macaddr` char(17) NOT NULL,
  `ipaddr4` varchar(15),
  `ipaddr6` varchar(45),
  `device_class` varchar(20) NOT NULL,
  `vendor` varchar(255),
  `is_l3` tinyint(1) NOT NULL,
  `vlanid` int NOT NULL DEFAULT 0,
  `parent_id` int,
  `node_id` int,
  `mod_time` bigint NOT NULL,
  `user_mod_time` bigint NOT NULL,
  `discover_time` bigint NOT NULL,
  `last_seen_time` bigint,
  `auto_role` varchar(50) NOT NULL,
  `role` varchar(50) NOT NULL,
  `analysis_level` tinyint NOT NULL,
  `analysis` varchar(20) NOT NULL,
  `on_watchlist` tinyint(1) NOT NULL DEFAULT 0,
  `critical` tinyint(1) NOT NULL DEFAULT 0,
  `custom_criticality` varchar(50),
  `model` varchar(255),
  `model_override` varchar(255),
  `custom_make` varchar(255),
  `custom_model` varchar(255),
  `custom_type` varchar(50) NOT NULL DEFAULT '',
  `cdp_name` varchar(255) NOT NULL DEFAULT '',
  `dhcp_name` varchar(255) NOT NULL DEFAULT '',
  `netbios_name` varchar(255) NOT NULL DEFAULT '',
  `dns_name` varchar(255) NOT NULL DEFAULT '',
  `cloud_instance_id` varchar(255),
  `cloud_instance_type` varchar(255),
  `cloud_instance_description` text,
  `cloud_instance_name` varchar(255),
  `cloud_account` varchar(255),
  `vpc_id` varchar(255),
  `subnet_id` varchar(255),
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Device Group
CREATE TABLE IF NOT EXISTS `dim_device_group` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `mod_time` bigint NOT NULL,
  `built_in` tinyint(1) NOT NULL,
  `include_custom_devices` tinyint(1) NOT NULL,
  `dynamic` tinyint(1) NOT NULL,
  `field` varchar(100),
  `value` varchar(255),
  `filter` json,
  `editors` json,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: VLAN
CREATE TABLE IF NOT EXISTS `dim_vlan` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `vlanid` int NOT NULL,
  `network_id` int NOT NULL,
  `node_id` int,
  `name` varchar(255),
  `description` text,
  `mod_time` bigint NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Alert
CREATE TABLE IF NOT EXISTS `dim_alert` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `author` varchar(100) NOT NULL,
  `description` text,
  `mod_time` bigint NOT NULL,
  `type` varchar(20) NOT NULL,
  `severity` tinyint NOT NULL,
  `disabled` tinyint(1) NOT NULL,
  `stat_name` varchar(255) NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `field_name2` varchar(100),
  `field_op` varchar(10),
  `operator` varchar(10) NOT NULL,
  `operand` varchar(100) NOT NULL,
  `units` varchar(20) NOT NULL DEFAULT 'none',
  `interval_length` int NOT NULL,
  `refire_interval` int NOT NULL,
  `notify_snmp` tinyint(1) NOT NULL DEFAULT 0,
  `apply_all` tinyint(1) NOT NULL DEFAULT 0,
  `param` json NOT NULL,
  `param2` json NOT NULL,
  `cc` json NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Tag
CREATE TABLE IF NOT EXISTS `dim_tag` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `mod_time` bigint NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dim_tag_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Application
CREATE TABLE IF NOT EXISTS `dim_application` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `extrahop_id` varchar(255) NOT NULL,
  `discovery_id` varchar(255) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `description` text,
  `criteria` json,
  `mod_time` bigint NOT NULL,
  `user_mod_time` bigint NOT NULL,
  `node_id` int,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Network Locality
CREATE TABLE IF NOT EXISTS `dim_network_locality` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(1000) NOT NULL DEFAULT '',
  `external` tinyint(1) NOT NULL,
  `mod_time` bigint NOT NULL,
  `network` varchar(50) NOT NULL,
  `networks` json NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Activity Map
CREATE TABLE IF NOT EXISTS `dim_activity_map` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `mod_time` bigint NOT NULL,
  `mode` varchar(20),
  `show_alert_status` tinyint(1),
  `weighting` varchar(20),
  `short_code` varchar(50),
  `walks` json,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Detection Format
CREATE TABLE IF NOT EXISTS `dim_detection_format` (
  `type` varchar(255) NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `display_name` varchar(500),
  `author` varchar(255),
  `categories` json,
  `is_user_created` tinyint(1),
  `mitre_categories` json,
  `properties` json,
  `status` varchar(50),
  `released` bigint,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension: Detection
CREATE TABLE IF NOT EXISTS `dim_detection` (
  `id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `appliance_id` int,
  `assignee` varchar(255),
  `categories` json,
  `create_time` bigint NOT NULL,
  `description` text,
  `end_time` bigint,
  `is_user_created` tinyint(1) NOT NULL DEFAULT 0,
  `mitre_tactics` json,
  `mitre_techniques` json,
  `mod_time` bigint NOT NULL,
  `participants` json,
  `properties` json,
  `recommended` tinyint(1),
  `recommended_factors` json,
  `resolution` varchar(50),
  `risk_score` int,
  `start_time` bigint NOT NULL,
  `status` varchar(50),
  `ticket_id` varchar(255),
  `ticket_url` varchar(2048),
  `title` varchar(500) NOT NULL,
  `type` varchar(255) NOT NULL,
  `url` varchar(2048),
  `update_time` bigint,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bridge: Device <-> Tag
CREATE TABLE IF NOT EXISTS `bridge_device_tag` (
  `device_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `observed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`device_id`, `tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bridge: Device <-> Device Group
CREATE TABLE IF NOT EXISTS `bridge_device_device_group` (
  `device_id` int NOT NULL,
  `device_group_id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `observed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`device_id`, `device_group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bridge: Alert <-> Application
CREATE TABLE IF NOT EXISTS `bridge_alert_application` (
  `alert_id` int NOT NULL,
  `application_id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `observed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`alert_id`, `application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bridge: Alert <-> Device
CREATE TABLE IF NOT EXISTS `bridge_alert_device` (
  `alert_id` int NOT NULL,
  `device_id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `observed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`alert_id`, `device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bridge: Alert <-> Device Group
CREATE TABLE IF NOT EXISTS `bridge_alert_device_group` (
  `alert_id` int NOT NULL,
  `device_group_id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `observed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`alert_id`, `device_group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bridge: Alert <-> Network
CREATE TABLE IF NOT EXISTS `bridge_alert_network` (
  `alert_id` int NOT NULL,
  `network_id` int NOT NULL,
  `raw_id` bigint unsigned NOT NULL,
  `observed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`alert_id`, `network_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Metric Response
CREATE TABLE IF NOT EXISTS `fact_metric_response` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `raw_id` bigint unsigned NOT NULL,
  `cycle` varchar(10) NOT NULL,
  `node_id` int NOT NULL,
  `clock` bigint NOT NULL,
  `from_time` bigint NOT NULL,
  `until_time` bigint NOT NULL,
  `metric_category` varchar(100) NOT NULL,
  `object_type` varchar(20) NOT NULL,
  `request_body` json NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Metric Stat
CREATE TABLE IF NOT EXISTS `fact_metric_stat` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `metric_response_id` bigint unsigned NOT NULL,
  `oid` int NOT NULL,
  `stat_time` bigint NOT NULL,
  `duration` int NOT NULL,
  `values_json` json NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Record Search
CREATE TABLE IF NOT EXISTS `fact_record_search` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `raw_id` bigint unsigned NOT NULL,
  `from_time` bigint NOT NULL,
  `until_time` bigint NOT NULL,
  `total` int NOT NULL,
  `terminated_early` tinyint(1) NOT NULL DEFAULT 0,
  `lookback_truncated` tinyint(1) NOT NULL DEFAULT 0,
  `lookback_exceeded` tinyint(1) NOT NULL DEFAULT 0,
  `request_body` json NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Record
CREATE TABLE IF NOT EXISTS `fact_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `search_id` bigint unsigned NOT NULL,
  `record_id` varchar(100) NOT NULL,
  `record_type` varchar(50) NOT NULL,
  `appliance_uuid` varchar(50) NOT NULL,
  `source_json` json NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fact: Device Activity
CREATE TABLE IF NOT EXISTS `fact_device_activity` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `raw_id` bigint unsigned NOT NULL,
  `activity_id` bigint NOT NULL,
  `device_id` int NOT NULL,
  `from_time` bigint NOT NULL,
  `until_time` bigint NOT NULL,
  `mod_time` bigint NOT NULL,
  `stat_name` varchar(255) NOT NULL,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fact_device_activity_activity_id_unique` (`activity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot: Device IP Address
CREATE TABLE IF NOT EXISTS `snap_device_ipaddr` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `raw_id` bigint unsigned NOT NULL,
  `device_id` int NOT NULL,
  `ipaddr` varchar(45) NOT NULL,
  `last_observation_time` bigint,
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot: Device DNS Name
CREATE TABLE IF NOT EXISTS `snap_device_dnsname` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `raw_id` bigint unsigned NOT NULL,
  `device_id` int NOT NULL,
  `dns_name` varchar(255) NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot: Device Software
CREATE TABLE IF NOT EXISTS `snap_device_software` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `raw_id` bigint unsigned NOT NULL,
  `device_id` int NOT NULL,
  `software_json` json NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 1,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot: Topology
CREATE TABLE IF NOT EXISTS `snap_topology` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `raw_id` bigint unsigned NOT NULL,
  `activity_map_id` int,
  `from_time` bigint NOT NULL,
  `until_time` bigint NOT NULL,
  `node_count` int NOT NULL DEFAULT 0,
  `edge_count` int NOT NULL DEFAULT 0,
  `polled_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot: Topology Node
CREATE TABLE IF NOT EXISTS `snap_topology_node` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `topology_id` bigint unsigned NOT NULL,
  `object_type` varchar(20) NOT NULL,
  `object_id` int,
  `ipaddr` varchar(45),
  `display_name` varchar(255),
  `role` varchar(50),
  `is_external` tinyint(1) NOT NULL DEFAULT 0,
  `weight` bigint NOT NULL DEFAULT 0,
  `node_data` json,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot: Topology Edge
CREATE TABLE IF NOT EXISTS `snap_topology_edge` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `topology_id` bigint unsigned NOT NULL,
  `source_node_id` bigint unsigned,
  `target_node_id` bigint unsigned,
  `protocol` varchar(50),
  `weight` bigint NOT NULL DEFAULT 0,
  `bytes_in` bigint NOT NULL DEFAULT 0,
  `bytes_out` bigint NOT NULL DEFAULT 0,
  `edge_data` json,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appliance Configuration (Slice 14)
CREATE TABLE IF NOT EXISTS `appliance_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `hostname` varchar(255) NOT NULL,
  `api_key` varchar(512) NOT NULL,
  `verify_ssl` tinyint(1) NOT NULL DEFAULT 1,
  `cloud_services_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `nickname` varchar(100) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_tested_at` timestamp NULL,
  `last_test_result` enum('success','failure','untested') NOT NULL DEFAULT 'untested',
  `last_test_message` varchar(1000) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schema Management
CREATE TABLE IF NOT EXISTS `schema_version` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `checksum` char(64) NOT NULL,
  `applied_at` datetime(3) NOT NULL,
  `applied_by` varchar(100),
  PRIMARY KEY (`id`),
  UNIQUE KEY `schema_version_filename_unique` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schema Drift Log
CREATE TABLE IF NOT EXISTS `schema_drift_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `run_at` datetime(3) NOT NULL,
  `mode` varchar(20) NOT NULL DEFAULT 'live',
  `endpoints_tested` int NOT NULL DEFAULT 0,
  `objects_validated` int NOT NULL DEFAULT 0,
  `total_issues` int NOT NULL DEFAULT 0,
  `exit_code` tinyint NOT NULL DEFAULT 0,
  `report_json` json,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Legacy tables from early migrations (kept for compatibility)
CREATE TABLE IF NOT EXISTS `alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `deviceId` int,
  `severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
  `message` text NOT NULL,
  `source` varchar(128),
  `acknowledged` int NOT NULL DEFAULT 0,
  `resolvedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `ipAddress` varchar(45) NOT NULL,
  `macAddress` varchar(17),
  `deviceType` varchar(64),
  `manufacturer` varchar(128),
  `model` varchar(128),
  `osVersion` varchar(128),
  `location` varchar(255),
  `status` enum('online','offline','warning','maintenance') NOT NULL DEFAULT 'offline',
  `lastSeen` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `interfaces` (
  `id` int NOT NULL AUTO_INCREMENT,
  `deviceId` int,
  `name` varchar(255) NOT NULL,
  `interfaceType` varchar(64),
  `status` enum('up','down','degraded') NOT NULL DEFAULT 'down',
  `speed` bigint,
  `inTraffic` bigint,
  `outTraffic` bigint,
  `mtu` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `performance_metrics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `deviceId` int,
  `latency` float,
  `throughput` bigint,
  `packetLoss` float,
  `jitter` float,
  `uptime` float,
  `measuredAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record this migration
INSERT INTO `schema_version` (`filename`, `checksum`, `applied_at`, `applied_by`)
VALUES ('full-schema-deploy.sql', SHA2('contract-phase-full-schema-2026-03-14', 256), NOW(3), 'deploy-script');
