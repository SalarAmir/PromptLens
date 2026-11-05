CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text NOT NULL,
	`audience` text NOT NULL,
	`competitors` text NOT NULL,
	`prompts` text NOT NULL,
	`tasks` text NOT NULL,
	`created_at` text NOT NULL,
	`last_audit_at` text
);
--> statement-breakpoint
CREATE TABLE `scan_usage` (
	`owner_day` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
