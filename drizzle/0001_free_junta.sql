CREATE TABLE `appliance_config` (
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
--> statement-breakpoint
CREATE TABLE `bridge_alert_application` (
	`alert_id` int NOT NULL,
	`application_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_application_alert_id_application_id_pk` PRIMARY KEY(`alert_id`,`application_id`)
);
--> statement-breakpoint
CREATE TABLE `bridge_alert_device` (
	`alert_id` int NOT NULL,
	`device_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_device_alert_id_device_id_pk` PRIMARY KEY(`alert_id`,`device_id`)
);
--> statement-breakpoint
CREATE TABLE `bridge_alert_device_group` (
	`alert_id` int NOT NULL,
	`device_group_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_device_group_alert_id_device_group_id_pk` PRIMARY KEY(`alert_id`,`device_group_id`)
);
--> statement-breakpoint
CREATE TABLE `bridge_alert_network` (
	`alert_id` int NOT NULL,
	`network_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_alert_network_alert_id_network_id_pk` PRIMARY KEY(`alert_id`,`network_id`)
);
--> statement-breakpoint
CREATE TABLE `bridge_device_device_group` (
	`device_id` int NOT NULL,
	`device_group_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_device_device_group_device_id_device_group_id_pk` PRIMARY KEY(`device_id`,`device_group_id`)
);
--> statement-breakpoint
CREATE TABLE `bridge_device_tag` (
	`device_id` int NOT NULL,
	`tag_id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	CONSTRAINT `bridge_device_tag_device_id_tag_id_pk` PRIMARY KEY(`device_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `dim_activity_map` (
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
--> statement-breakpoint
CREATE TABLE `dim_alert` (
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
--> statement-breakpoint
CREATE TABLE `dim_appliance` (
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
--> statement-breakpoint
CREATE TABLE `dim_application` (
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
--> statement-breakpoint
CREATE TABLE `dim_detection` (
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
--> statement-breakpoint
CREATE TABLE `dim_detection_format` (
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
--> statement-breakpoint
CREATE TABLE `dim_device` (
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
--> statement-breakpoint
CREATE TABLE `dim_device_group` (
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
--> statement-breakpoint
CREATE TABLE `dim_network` (
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
--> statement-breakpoint
CREATE TABLE `dim_network_locality` (
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
--> statement-breakpoint
CREATE TABLE `dim_tag` (
	`id` int NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`mod_time` bigint NOT NULL,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `dim_tag_id` PRIMARY KEY(`id`),
	CONSTRAINT `dim_tag_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dim_vlan` (
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
--> statement-breakpoint
CREATE TABLE `fact_device_activity` (
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
--> statement-breakpoint
CREATE TABLE `fact_metric_response` (
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
--> statement-breakpoint
CREATE TABLE `fact_metric_stat` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`metric_response_id` bigint unsigned NOT NULL,
	`oid` int NOT NULL,
	`stat_time` bigint NOT NULL,
	`duration` int NOT NULL,
	`values_json` json NOT NULL,
	CONSTRAINT `fact_metric_stat_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fact_record` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`search_id` bigint unsigned NOT NULL,
	`record_id` varchar(100) NOT NULL,
	`record_type` varchar(50) NOT NULL,
	`appliance_uuid` varchar(50) NOT NULL,
	`source_json` json NOT NULL,
	CONSTRAINT `fact_record_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fact_record_search` (
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
--> statement-breakpoint
CREATE TABLE `raw_api_response` (
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
--> statement-breakpoint
CREATE TABLE `saved_topology_views` (
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
--> statement-breakpoint
CREATE TABLE `schema_drift_log` (
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
--> statement-breakpoint
CREATE TABLE `schema_version` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`checksum` char(64) NOT NULL,
	`applied_at` datetime(3) NOT NULL,
	`applied_by` varchar(100),
	CONSTRAINT `schema_version_id` PRIMARY KEY(`id`),
	CONSTRAINT `schema_version_filename_unique` UNIQUE(`filename`)
);
--> statement-breakpoint
CREATE TABLE `snap_device_dnsname` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`device_id` int NOT NULL,
	`dns_name` varchar(255) NOT NULL,
	`is_current` boolean NOT NULL DEFAULT true,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `snap_device_dnsname_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snap_device_ipaddr` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`device_id` int NOT NULL,
	`ipaddr` varchar(45) NOT NULL,
	`last_observation_time` bigint,
	`is_current` boolean NOT NULL DEFAULT true,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `snap_device_ipaddr_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snap_device_software` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_id` bigint unsigned NOT NULL,
	`device_id` int NOT NULL,
	`software_json` json NOT NULL,
	`is_current` boolean NOT NULL DEFAULT true,
	`polled_at` datetime(3) NOT NULL,
	CONSTRAINT `snap_device_software_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snap_topology` (
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
--> statement-breakpoint
CREATE TABLE `snap_topology_edge` (
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
--> statement-breakpoint
CREATE TABLE `snap_topology_node` (
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
