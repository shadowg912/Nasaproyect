CREATE TABLE `calibration` (
	`region_key` text PRIMARY KEY NOT NULL,
	`k` real NOT NULL,
	`ci_lo` real NOT NULL,
	`ci_hi` real NOT NULL,
	`r2` real NOT NULL,
	`k_terra` real NOT NULL,
	`overlap_from` integer NOT NULL,
	`overlap_to` integer NOT NULL,
	`source` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `context_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `countries` (
	`iso3` text PRIMARY KEY NOT NULL,
	`name_es` text NOT NULL,
	`firms_name` text NOT NULL,
	`bbox_json` text NOT NULL,
	`mode` text
);
--> statement-breakpoint
CREATE TABLE `country_loads` (
	`iso3` text NOT NULL,
	`product` text NOT NULL,
	`year` integer NOT NULL,
	`state` text NOT NULL,
	`rows` integer DEFAULT 0 NOT NULL,
	`error` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`iso3`, `product`, `year`)
);
--> statement-breakpoint
CREATE TABLE `harmonized_monthly` (
	`region_key` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`modis_raw` integer DEFAULT 0 NOT NULL,
	`viirs_raw` integer DEFAULT 0 NOT NULL,
	`modis_cd` integer DEFAULT 0 NOT NULL,
	`viirs_cd` integer DEFAULT 0 NOT NULL,
	`harmonized` real,
	`single_satellite` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`region_key`, `year`, `month`)
);
