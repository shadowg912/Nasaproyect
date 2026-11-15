ALTER TABLE `fire_detections` ADD `country_iso3` text DEFAULT 'DOM' NOT NULL;--> statement-breakpoint
ALTER TABLE `fire_detections` ADD `fire_type` integer;--> statement-breakpoint
ALTER TABLE `fire_detections` ADD `sensor_family` text;--> statement-breakpoint
CREATE INDEX `fire_country_date_idx` ON `fire_detections` (`country_iso3`,`acq_date`);