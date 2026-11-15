CREATE TABLE `fire_detections` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`satellite` text NOT NULL,
	`instrument` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`acq_date` text NOT NULL,
	`acq_time` text NOT NULL,
	`acquired_at` text NOT NULL,
	`brightness` real,
	`bright_t31` real,
	`scan` real,
	`track` real,
	`frp` real,
	`confidence` text NOT NULL,
	`confidence_raw` text NOT NULL,
	`version` text,
	`daynight` text,
	`province_id` integer,
	`municipality_id` integer,
	`ingestion_run_id` integer,
	`first_seen_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingestion_run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fire_acq_date_idx` ON `fire_detections` (`acq_date`);--> statement-breakpoint
CREATE INDEX `fire_source_date_idx` ON `fire_detections` (`source`,`acq_date`);--> statement-breakpoint
CREATE INDEX `fire_satellite_date_idx` ON `fire_detections` (`satellite`,`acq_date`);--> statement-breakpoint
CREATE INDEX `fire_province_date_idx` ON `fire_detections` (`province_id`,`acq_date`);--> statement-breakpoint
CREATE INDEX `fire_municipality_idx` ON `fire_detections` (`municipality_id`);--> statement-breakpoint
CREATE TABLE `ingestion_coverage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`date_from` text NOT NULL,
	`date_to` text NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`run_id` integer,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `ingestion_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coverage_source_interval_uq` ON `ingestion_coverage` (`source`,`date_from`,`date_to`);--> statement-breakpoint
CREATE INDEX `coverage_dates_idx` ON `ingestion_coverage` (`date_from`,`date_to`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`status` text NOT NULL,
	`sources` text NOT NULL,
	`date_from` text,
	`date_to` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`requests` integer DEFAULT 0 NOT NULL,
	`rows_fetched` integer DEFAULT 0 NOT NULL,
	`rows_in_country` integer DEFAULT 0 NOT NULL,
	`rows_inserted` integer DEFAULT 0 NOT NULL,
	`rows_updated` integer DEFAULT 0 NOT NULL,
	`rows_rejected` integer DEFAULT 0 NOT NULL,
	`error_type` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `ingestion_runs_started_idx` ON `ingestion_runs` (`started_at`);--> statement-breakpoint
CREATE INDEX `ingestion_runs_status_idx` ON `ingestion_runs` (`status`);--> statement-breakpoint
CREATE TABLE `municipalities` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`province_id` integer,
	`area_km2` real,
	FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `municipalities_code_unique` ON `municipalities` (`code`);--> statement-breakpoint
CREATE INDEX `municipalities_province_idx` ON `municipalities` (`province_id`);--> statement-breakpoint
CREATE TABLE `provinces` (
	`id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`area_km2` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provinces_code_unique` ON `provinces` (`code`);--> statement-breakpoint
CREATE TABLE `sync_lock` (
	`name` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`acquired_at` text NOT NULL,
	`expires_at` text NOT NULL
);
