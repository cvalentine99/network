CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int,
	`severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`message` text NOT NULL,
	`source` varchar(128),
	`acknowledged` int NOT NULL DEFAULT 0,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`macAddress` varchar(17),
	`deviceType` varchar(64),
	`manufacturer` varchar(128),
	`model` varchar(128),
	`osVersion` varchar(128),
	`location` varchar(255),
	`status` enum('online','offline','warning','maintenance') NOT NULL DEFAULT 'offline',
	`lastSeen` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interfaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int,
	`name` varchar(255) NOT NULL,
	`interfaceType` varchar(64),
	`status` enum('up','down','degraded') NOT NULL DEFAULT 'down',
	`speed` bigint,
	`inTraffic` bigint,
	`outTraffic` bigint,
	`mtu` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interfaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performance_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int,
	`latency` float,
	`throughput` bigint,
	`packetLoss` float,
	`jitter` float,
	`uptime` float,
	`measuredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performance_metrics_id` PRIMARY KEY(`id`)
);
