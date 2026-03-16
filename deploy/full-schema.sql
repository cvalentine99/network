-- ============================================================================
-- Network Performance Dashboard — Full Schema
-- Generated from drizzle/schema.ts via drizzle-kit migrations
-- Source of truth: drizzle/schema.ts
-- ============================================================================
-- This file is auto-generated. Do NOT edit manually.
-- To regenerate: run drizzle-kit generate, then rebuild this file.
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ─── Migration 0000: users table ───

CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);


-- ─── Migration 0001: all domain tables ───

CREATE TABLE IF NOT EXISTS `appliance_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostname` varchar(255) NOT NULL,
	`api_key` varchar(512) NOT NULL,
	`verify_ssl` boolean NOT NULL DEFAULT true,
	`cloud_services_enabled` boolean NOT NULL DEFAULT false,
	`nickname` varchar(100) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`last_tested_at` timestamp,
	`last_test_result` enum('success','failure','untested') NOT NULL DEFAULT 'untested',
	`last_test_message` varchar(1000) NOT NULL DEFAULT '',
	CONSTRAINT `appliance_config_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `bridge_alert_application` (
	`alert_id` int NOT NULL,
	`application_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_application_alert_id_application_id_pk` PRIMARY KEY(`alert_id`,`application_id`)
);
CREATE TABLE IF NOT EXISTS `bridge_alert_device` (
	`alert_id` int NOT NULL,
	`device_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_device_alert_id_device_id_pk` PRIMARY KEY(`alert_id`,`device_id`)
);
CREATE TABLE IF NOT EXISTS `bridge_alert_device_group` (
	`alert_id` int NOT NULL,
	`device_group_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_device_group_alert_id_device_group_id_pk` PRIMARY KEY(`alert_id`,`device_group_id`)
);
CREATE TABLE IF NOT EXISTS `bridge_alert_network` (
	`alert_id` int NOT NULL,
	`network_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_network_alert_id_network_id_pk` PRIMARY KEY(`alert_id`,`network_id`)
);
CREATE TABLE IF NOT EXISTS `bridge_device_device_group` (
	`device_id` int NOT NULL,
	`device_group_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_device_device_group_device_id_device_group_id_pk` PRIMARY KEY(`device_id`,`device_group_id`)
);
CREATE TABLE IF NOT EXISTS `bridge_device_tag` (
	`device_id` int NOT NULL,
	`tag_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_device_tag_device_id_tag_id_pk` PRIMARY KEY(`device_id`,`tag_id`)
);
CREATE TABLE IF NOT EXISTS `dim_activity_map` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`mod_time` bigint NOT NULL,
	`mode` varchar(20),
	`show_alert_status` boolean,
	`weighting` varchar(20),
	`short_code` varchar(50),
	`walks` json,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_activity_map_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `dim_alert` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`author` varchar(100) NOT NULL,
	`description` text,
	`mod_time` bigint NOT NULL,
	`type` varchar(20) NOT NULL,
	`severity` tinyint NOT NULL,
	`disabled` boolean NOT NULL,
	`stat_name` varchar(255) NOT NULL,
	`field_name` varchar(100) NOT NULL,
	`field_name2` varchar(100),
	`field_op` varchar(10),
	`operator` varchar(10) NOT NULL,
	`operand` varchar(100) NOT NULL,
	`units` varchar(20) NOT NULL DEFAULT 'none',
	`interval_length` int NOT NULL,
	`refire_interval` int NOT NULL,
	`notify_snmp` boolean NOT NULL DEFAULT false,
	`apply_all` boolean NOT NULL DEFAULT false,
	`param` json NOT NULL,
	`param2` json NOT NULL,
	`cc` json NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_alert_id` PRIMARY KEY(`id`)
);
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
	`manages_local` boolean NOT NULL,
	`managed_by_local` boolean NOT NULL,
	`data_access` boolean NOT NULL,
	`fingerprint` varchar(200),
	`total_capacity` int,
	`advanced_analysis_capacity` int,
	`add_time` bigint,
	`sync_time` bigint NOT NULL DEFAULT 0,
	`analysis_levels_managed` boolean NOT NULL,
	`nickname` varchar(255) NOT NULL DEFAULT '',
	`display_name` varchar(255) NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_appliance_id` PRIMARY KEY(`id`),
	CONSTRAINT `dim_appliance_uuid_unique` UNIQUE(`uuid`)
);
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
	CONSTRAINT `dim_application_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `dim_detection` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`appliance_id` int,
	`assignee` varchar(255),
	`categories` json,
	`create_time` bigint NOT NULL,
	`description` text,
	`end_time` bigint,
	`is_user_created` boolean NOT NULL DEFAULT false,
	`mitre_tactics` json,
	`mitre_techniques` json,
	`mod_time` bigint NOT NULL,
	`participants` json,
	`properties` json,
	`recommended` boolean,
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
	CONSTRAINT `dim_detection_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `dim_detection_format` (
	`type` varchar(255) NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`display_name` varchar(500),
	`author` varchar(255),
	`categories` json,
	`is_user_created` boolean,
	`mitre_categories` json,
	`properties` json,
	`status` varchar(50),
	`released` bigint,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_detection_format_type` PRIMARY KEY(`type`)
);
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
	`is_l3` boolean NOT NULL,
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
	`on_watchlist` boolean NOT NULL DEFAULT false,
	`critical` boolean NOT NULL DEFAULT false,
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
	CONSTRAINT `dim_device_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `dim_device_group` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`mod_time` bigint NOT NULL,
	`built_in` boolean NOT NULL,
	`include_custom_devices` boolean NOT NULL,
	`dynamic` boolean NOT NULL,
	`field` varchar(100),
	`value` varchar(255),
	`filter` json,
	`editors` json,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_device_group_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `dim_network` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`node_id` int,
	`appliance_uuid` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`mod_time` bigint NOT NULL,
	`idle` boolean NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_network_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `dim_network_locality` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` varchar(1000) NOT NULL DEFAULT '',
	`external` boolean NOT NULL,
	`mod_time` bigint NOT NULL,
	`network` varchar(50) NOT NULL,
	`networks` json NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_network_locality_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `dim_tag` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`mod_time` bigint NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_tag_id` PRIMARY KEY(`id`),
	CONSTRAINT `dim_tag_name_unique` UNIQUE(`name`)
);
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
	CONSTRAINT `dim_vlan_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `fact_device_activity` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`activity_id` bigint NOT NULL,
	`device_id` int NOT NULL,
	`from_time` bigint NOT NULL,
	`until_time` bigint NOT NULL,
	`mod_time` bigint NOT NULL,
	`stat_name` varchar(255) NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `fact_device_activity_id` PRIMARY KEY(`id`),
	CONSTRAINT `fact_device_activity_activity_id_unique` UNIQUE(`activity_id`)
);
CREATE TABLE IF NOT EXISTS `fact_metric_response` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
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
	CONSTRAINT `fact_metric_response_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `fact_metric_stat` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`metric_response_id` bigint unsigned NOT NULL,
	`oid` int NOT NULL,
	`stat_time` bigint NOT NULL,
	`duration` int NOT NULL,
	`values_json` json NOT NULL,
	CONSTRAINT `fact_metric_stat_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `fact_record` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`search_id` bigint unsigned NOT NULL,
	`record_id` varchar(100) NOT NULL,
	`record_type` varchar(50) NOT NULL,
	`appliance_uuid` varchar(50) NOT NULL,
	`source_json` json NOT NULL,
	CONSTRAINT `fact_record_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `fact_record_search` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`from_time` bigint NOT NULL,
	`until_time` bigint NOT NULL,
	`total` int NOT NULL,
	`terminated_early` boolean NOT NULL DEFAULT false,
	`lookback_truncated` boolean NOT NULL DEFAULT false,
	`lookback_exceeded` boolean NOT NULL DEFAULT false,
	`request_body` json NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `fact_record_search_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `raw_api_response` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
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
	CONSTRAINT `raw_api_response_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `saved_topology_views` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`view_mode` varchar(20) NOT NULL DEFAULT 'constellation',
	`zoom` double NOT NULL DEFAULT 1,
	`pan_x` double NOT NULL DEFAULT 0,
	`pan_y` double NOT NULL DEFAULT 0,
	`collapsed_subnets` json NOT NULL,
	`role_filters` json NOT NULL,
	`protocol_filters` json NOT NULL,
	`anomaly_overlay_enabled` boolean NOT NULL DEFAULT false,
	`anomaly_threshold` double NOT NULL DEFAULT 50,
	`critical_path_source` int,
	`critical_path_destination` int,
	`search_term` varchar(255) NOT NULL DEFAULT '',
	`node_positions` json DEFAULT ('null'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_topology_views_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `schema_drift_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`run_at` datetime(3) NOT NULL,
	`mode` varchar(20) NOT NULL DEFAULT 'live',
	`endpoints_tested` int NOT NULL DEFAULT 0,
	`objects_validated` int NOT NULL DEFAULT 0,
	`total_issues` int NOT NULL DEFAULT 0,
	`exit_code` tinyint NOT NULL DEFAULT 0,
	`report_json` json,
	CONSTRAINT `schema_drift_log_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `schema_version` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`checksum` char(64) NOT NULL,
	`applied_at` datetime(3) NOT NULL,
	`applied_by` varchar(100),
	CONSTRAINT `schema_version_id` PRIMARY KEY(`id`),
	CONSTRAINT `schema_version_filename_unique` UNIQUE(`filename`)
);
CREATE TABLE IF NOT EXISTS `snap_device_dnsname` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`device_id` int NOT NULL,
	`dns_name` varchar(255) NOT NULL,
	`is_current` boolean NOT NULL DEFAULT true,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `snap_device_dnsname_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `snap_device_ipaddr` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`device_id` int NOT NULL,
	`ipaddr` varchar(45) NOT NULL,
	`last_observation_time` bigint,
	`is_current` boolean NOT NULL DEFAULT true,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `snap_device_ipaddr_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `snap_device_software` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`device_id` int NOT NULL,
	`software_json` json NOT NULL,
	`is_current` boolean NOT NULL DEFAULT true,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `snap_device_software_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `snap_topology` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`activity_map_id` int,
	`from_time` bigint NOT NULL,
	`until_time` bigint NOT NULL,
	`node_count` int NOT NULL DEFAULT 0,
	`edge_count` int NOT NULL DEFAULT 0,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `snap_topology_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `snap_topology_edge` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`topology_id` bigint unsigned NOT NULL,
	`source_node_id` bigint unsigned,
	`target_node_id` bigint unsigned,
	`protocol` varchar(50),
	`weight` bigint NOT NULL DEFAULT 0,
	`bytes_in` bigint NOT NULL DEFAULT 0,
	`bytes_out` bigint NOT NULL DEFAULT 0,
	`edge_data` json,
	CONSTRAINT `snap_topology_edge_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `snap_topology_node` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`topology_id` bigint unsigned NOT NULL,
	`object_type` varchar(20) NOT NULL,
	`object_id` int,
	`ipaddr` varchar(45),
	`display_name` varchar(255),
	`role` varchar(50),
	`is_external` boolean NOT NULL DEFAULT false,
	`weight` bigint NOT NULL DEFAULT 0,
	`node_data` json,
	CONSTRAINT `snap_topology_node_id` PRIMARY KEY(`id`)
);


-- ─── Views (portable — no hardcoded DB name) ───

-- View: v_active_devices
CREATE OR REPLACE VIEW `v_active_devices` AS
SELECT `d`.`id` AS `id`,`d`.`display_name` AS `display_name`,`d`.`default_name` AS `default_name`,`d`.`custom_name` AS `custom_name`,`d`.`macaddr` AS `macaddr`,`d`.`ipaddr4` AS `ipaddr4`,`d`.`ipaddr6` AS `ipaddr6`,`d`.`device_class` AS `device_class`,`d`.`vendor` AS `vendor`,`d`.`role` AS `role`,`d`.`analysis` AS `analysis`,`d`.`analysis_level` AS `analysis_level`,`d`.`on_watchlist` AS `on_watchlist`,`d`.`critical` AS `critical`,`d`.`dns_name` AS `dns_name`,`d`.`dhcp_name` AS `dhcp_name`,`d`.`cloud_instance_name` AS `cloud_instance_name`,`d`.`cloud_account` AS `cloud_account`,FROM_UNIXTIME(`d`.`discover_time`/1000) AS `discover_datetime`,FROM_UNIXTIME(`d`.`last_seen_time`/1000) AS `last_seen_datetime`,`d`.`polled_at` AS `polled_at` FROM `dim_device` AS `d` WHERE `d`.`last_seen_time` IS NOT NULL;

-- View: v_alert_summary
CREATE OR REPLACE VIEW `v_alert_summary` AS
SELECT `a`.`id` AS `alert_id`,`a`.`name` AS `name`,`a`.`type` AS `type`,`a`.`severity` AS `severity`,`a`.`disabled` AS `disabled`,`a`.`stat_name` AS `stat_name`,`a`.`field_name` AS `field_name`,`a`.`operator` AS `operator`,`a`.`operand` AS `operand`,`a`.`units` AS `units`,`a`.`interval_length` AS `interval_length`,`a`.`refire_interval` AS `refire_interval`,`a`.`apply_all` AS `apply_all`,`a`.`polled_at` AS `polled_at` FROM `dim_alert` AS `a`;

-- View: v_appliance_overview
CREATE OR REPLACE VIEW `v_appliance_overview` AS
SELECT `a`.`id` AS `id`,`a`.`hostname` AS `hostname`,`a`.`display_name` AS `display_name`,`a`.`platform` AS `platform`,`a`.`firmware_version` AS `firmware_version`,`a`.`license_status` AS `license_status`,`a`.`connection_type` AS `connection_type`,`a`.`manages_local` AS `manages_local`,`a`.`managed_by_local` AS `managed_by_local`,`a`.`data_access` AS `data_access`,`a`.`total_capacity` AS `total_capacity`,`a`.`advanced_analysis_capacity` AS `advanced_analysis_capacity`,`a`.`nickname` AS `nickname`,`a`.`polled_at` AS `polled_at` FROM `dim_appliance` AS `a`;

-- View: v_device_current_ips
CREATE OR REPLACE VIEW `v_device_current_ips` AS
SELECT `d`.`id` AS `device_id`,`d`.`display_name` AS `display_name`,`d`.`macaddr` AS `macaddr`,`s`.`ipaddr` AS `ipaddr`,FROM_UNIXTIME(`s`.`last_observation_time`/1000) AS `last_observed_datetime` FROM `dim_device` AS `d` JOIN `snap_device_ipaddr` AS `s` ON `s`.`device_id`=`d`.`id` AND `s`.`is_current`=TRUE;

-- View: v_device_group_membership
CREATE OR REPLACE VIEW `v_device_group_membership` AS
SELECT `dg`.`id` AS `group_id`,`dg`.`name` AS `group_name`,`dg`.`built_in` AS `built_in`,`dg`.`dynamic` AS `dynamic`,`d`.`id` AS `device_id`,`d`.`display_name` AS `device_name`,`d`.`device_class` AS `device_class`,`d`.`role` AS `role` FROM (`dim_device_group` AS `dg` JOIN `bridge_device_device_group` AS `b` ON `b`.`device_group_id`=`dg`.`id`) JOIN `dim_device` AS `d` ON `d`.`id`=`b`.`device_id`;

-- View: v_metric_responses
CREATE OR REPLACE VIEW `v_metric_responses` AS
SELECT `mr`.`id` AS `response_id`,`mr`.`cycle` AS `cycle`,`mr`.`metric_category` AS `metric_category`,`mr`.`object_type` AS `object_type`,FROM_UNIXTIME(`mr`.`from_time`/1000) AS `from_datetime`,FROM_UNIXTIME(`mr`.`until_time`/1000) AS `until_datetime`,`ms`.`oid` AS `oid`,`ms`.`duration` AS `duration`,`ms`.`values_json` AS `values_json`,FROM_UNIXTIME(`ms`.`stat_time`/1000) AS `stat_datetime`,`mr`.`polled_at` AS `polled_at` FROM `fact_metric_response` AS `mr` JOIN `fact_metric_stat` AS `ms` ON `ms`.`metric_response_id`=`mr`.`id`;

-- View: v_record_searches
CREATE OR REPLACE VIEW `v_record_searches` AS
SELECT `rs`.`id` AS `search_id`,FROM_UNIXTIME(`rs`.`from_time`/1000) AS `from_datetime`,FROM_UNIXTIME(`rs`.`until_time`/1000) AS `until_datetime`,`rs`.`total` AS `total`,`rs`.`terminated_early` AS `terminated_early`,`rs`.`lookback_truncated` AS `lookback_truncated`,`rs`.`lookback_exceeded` AS `lookback_exceeded`,`r`.`record_id` AS `record_id`,`r`.`record_type` AS `record_type`,`r`.`appliance_uuid` AS `appliance_uuid`,`r`.`source_json` AS `source_json`,`rs`.`polled_at` AS `polled_at` FROM `fact_record_search` AS `rs` JOIN `fact_record` AS `r` ON `r`.`search_id`=`rs`.`id`;

-- View: vw_alert_assignments_current
CREATE OR REPLACE VIEW `vw_alert_assignments_current` AS
SELECT `a`.`id` AS `alert_id`,`a`.`name` AS `name`,`a`.`type` AS `type`,`a`.`severity` AS `severity`,`a`.`disabled` AS `disabled`,`a`.`stat_name` AS `stat_name`,`a`.`field_name` AS `field_name`,`a`.`operator` AS `operator`,`a`.`operand` AS `operand`,`a`.`units` AS `units`,`a`.`interval_length` AS `interval_length`,`a`.`refire_interval` AS `refire_interval`,`a`.`apply_all` AS `apply_all`,(SELECT COUNT(1) AS `COUNT(*)` FROM `bridge_alert_device` AS `bd` WHERE `bd`.`alert_id`=`a`.`id`) AS `device_count`,(SELECT COUNT(1) AS `COUNT(*)` FROM `bridge_alert_device_group` AS `bg` WHERE `bg`.`alert_id`=`a`.`id`) AS `group_count`,(SELECT COUNT(1) AS `COUNT(*)` FROM `bridge_alert_application` AS `ba` WHERE `ba`.`alert_id`=`a`.`id`) AS `app_count`,(SELECT COUNT(1) AS `COUNT(*)` FROM `bridge_alert_network` AS `bn` WHERE `bn`.`alert_id`=`a`.`id`) AS `network_count`,`a`.`raw_id` AS `raw_id`,`a`.`polled_at` AS `polled_at` FROM `dim_alert` AS `a`;

-- View: vw_device_dns_current
CREATE OR REPLACE VIEW `vw_device_dns_current` AS
SELECT `s`.`device_id` AS `device_id`,`d`.`display_name` AS `display_name`,`s`.`dns_name` AS `dns_name`,`s`.`raw_id` AS `raw_id`,`s`.`polled_at` AS `polled_at` FROM `snap_device_dnsname` AS `s` JOIN `dim_device` AS `d` ON `d`.`id`=`s`.`device_id` WHERE `s`.`is_current`=TRUE;

-- View: vw_device_inventory_current
CREATE OR REPLACE VIEW `vw_device_inventory_current` AS
SELECT `d`.`id` AS `device_id`,`d`.`display_name` AS `display_name`,`d`.`default_name` AS `default_name`,`d`.`custom_name` AS `custom_name`,`d`.`macaddr` AS `macaddr`,`d`.`ipaddr4` AS `ipaddr4`,`d`.`ipaddr6` AS `ipaddr6`,`d`.`device_class` AS `device_class`,`d`.`vendor` AS `vendor`,`d`.`role` AS `role`,`d`.`auto_role` AS `auto_role`,`d`.`analysis` AS `analysis`,`d`.`analysis_level` AS `analysis_level`,`d`.`is_l3` AS `is_l3`,`d`.`vlanid` AS `vlanid`,`d`.`on_watchlist` AS `on_watchlist`,`d`.`critical` AS `critical`,`d`.`dns_name` AS `dns_name`,`d`.`dhcp_name` AS `dhcp_name`,`d`.`netbios_name` AS `netbios_name`,`d`.`cdp_name` AS `cdp_name`,FROM_UNIXTIME(`d`.`discover_time`/1000) AS `discover_datetime`,FROM_UNIXTIME(`d`.`last_seen_time`/1000) AS `last_seen_datetime`,FROM_UNIXTIME(`d`.`mod_time`/1000) AS `mod_datetime`,`d`.`raw_id` AS `raw_id`,`d`.`polled_at` AS `polled_at` FROM `dim_device` AS `d`;

-- View: vw_device_ip_current
CREATE OR REPLACE VIEW `vw_device_ip_current` AS
SELECT `s`.`device_id` AS `device_id`,`d`.`display_name` AS `display_name`,`s`.`ipaddr` AS `ipaddr`,FROM_UNIXTIME(`s`.`last_observation_time`/1000) AS `last_observed_datetime`,`s`.`raw_id` AS `raw_id`,`s`.`polled_at` AS `polled_at` FROM `snap_device_ipaddr` AS `s` JOIN `dim_device` AS `d` ON `d`.`id`=`s`.`device_id` WHERE `s`.`is_current`=TRUE;

-- View: vw_metric_latest_by_object
CREATE OR REPLACE VIEW `vw_metric_latest_by_object` AS
SELECT `mr`.`metric_category` AS `metric_category`,`mr`.`object_type` AS `object_type`,`ms`.`oid` AS `oid`,`ms`.`stat_time` AS `stat_time`,`ms`.`duration` AS `duration`,`ms`.`values_json` AS `values_json`,FROM_UNIXTIME(`ms`.`stat_time`/1000) AS `stat_datetime`,`mr`.`raw_id` AS `raw_id`,`mr`.`polled_at` AS `polled_at` FROM `fact_metric_stat` AS `ms` JOIN `fact_metric_response` AS `mr` ON `mr`.`id`=`ms`.`metric_response_id` WHERE `ms`.`stat_time`=(SELECT MAX(`ms2`.`stat_time`) AS `MAX(ms2.stat_time)` FROM `fact_metric_stat` AS `ms2` JOIN `fact_metric_response` AS `mr2` ON `mr2`.`id`=`ms2`.`metric_response_id` WHERE `mr2`.`metric_category`=`mr`.`metric_category` AND `ms2`.`oid`=`ms`.`oid`);

-- View: vw_topology_edges_by_snapshot
CREATE OR REPLACE VIEW `vw_topology_edges_by_snapshot` AS
SELECT `e`.`id` AS `edge_id`,`e`.`topology_id` AS `topology_id`,`t`.`activity_map_id` AS `activity_map_id`,`e`.`source_node_id` AS `source_node_id`,`src`.`display_name` AS `source_display_name`,`src`.`ipaddr` AS `source_ipaddr`,`e`.`target_node_id` AS `target_node_id`,`tgt`.`display_name` AS `target_display_name`,`tgt`.`ipaddr` AS `target_ipaddr`,`e`.`protocol` AS `protocol`,`e`.`weight` AS `weight`,`e`.`bytes_in` AS `bytes_in`,`e`.`bytes_out` AS `bytes_out`,`e`.`edge_data` AS `edge_data`,`t`.`raw_id` AS `raw_id`,`t`.`polled_at` AS `polled_at` FROM ((`snap_topology_edge` AS `e` JOIN `snap_topology` AS `t` ON `t`.`id`=`e`.`topology_id`) LEFT JOIN `snap_topology_node` AS `src` ON `src`.`id`=`e`.`source_node_id`) LEFT JOIN `snap_topology_node` AS `tgt` ON `tgt`.`id`=`e`.`target_node_id`;

-- View: vw_topology_latest_edges
CREATE OR REPLACE VIEW `vw_topology_latest_edges` AS
SELECT `e`.`id` AS `edge_id`,`e`.`topology_id` AS `topology_id`,`t`.`activity_map_id` AS `activity_map_id`,`e`.`source_node_id` AS `source_node_id`,`src`.`display_name` AS `source_display_name`,`src`.`ipaddr` AS `source_ipaddr`,`e`.`target_node_id` AS `target_node_id`,`tgt`.`display_name` AS `target_display_name`,`tgt`.`ipaddr` AS `target_ipaddr`,`e`.`protocol` AS `protocol`,`e`.`weight` AS `weight`,`e`.`bytes_in` AS `bytes_in`,`e`.`bytes_out` AS `bytes_out`,`e`.`edge_data` AS `edge_data`,`t`.`raw_id` AS `raw_id`,`t`.`polled_at` AS `polled_at` FROM ((`snap_topology_edge` AS `e` JOIN `snap_topology` AS `t` ON `t`.`id`=`e`.`topology_id`) LEFT JOIN `snap_topology_node` AS `src` ON `src`.`id`=`e`.`source_node_id`) LEFT JOIN `snap_topology_node` AS `tgt` ON `tgt`.`id`=`e`.`target_node_id` WHERE `t`.`polled_at`=(SELECT MAX(`polled_at`) AS `MAX(polled_at)` FROM `snap_topology`);

-- View: vw_topology_latest_nodes
CREATE OR REPLACE VIEW `vw_topology_latest_nodes` AS
SELECT `n`.`id` AS `node_id`,`n`.`topology_id` AS `topology_id`,`t`.`activity_map_id` AS `activity_map_id`,`n`.`object_type` AS `object_type`,`n`.`object_id` AS `object_id`,`n`.`ipaddr` AS `ipaddr`,`n`.`display_name` AS `display_name`,`n`.`role` AS `role`,`n`.`is_external` AS `is_external`,`n`.`weight` AS `weight`,`n`.`node_data` AS `node_data`,`t`.`raw_id` AS `raw_id`,`t`.`polled_at` AS `polled_at` FROM `snap_topology_node` AS `n` JOIN `snap_topology` AS `t` ON `t`.`id`=`n`.`topology_id` WHERE `t`.`polled_at`=(SELECT MAX(`polled_at`) AS `MAX(polled_at)` FROM `snap_topology`);

-- View: vw_topology_nodes_by_snapshot
CREATE OR REPLACE VIEW `vw_topology_nodes_by_snapshot` AS
SELECT `n`.`id` AS `node_id`,`n`.`topology_id` AS `topology_id`,`t`.`activity_map_id` AS `activity_map_id`,`n`.`object_type` AS `object_type`,`n`.`object_id` AS `object_id`,`n`.`ipaddr` AS `ipaddr`,`n`.`display_name` AS `display_name`,`n`.`role` AS `role`,`n`.`is_external` AS `is_external`,`n`.`weight` AS `weight`,`n`.`node_data` AS `node_data`,`t`.`raw_id` AS `raw_id`,`t`.`polled_at` AS `polled_at` FROM `snap_topology_node` AS `n` JOIN `snap_topology` AS `t` ON `t`.`id`=`n`.`topology_id`;


-- ─── Schema version tracking ───

INSERT INTO `schema_version` (`filename`, `checksum`, `applied_at`, `applied_by`)
VALUES ('full-schema-deploy.sql', SHA2('contract-phase-full-schema-2026-03-16-regenerated', 256), NOW(3), 'deploy-script');
