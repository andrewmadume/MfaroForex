CREATE TABLE `accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`window_id` integer NOT NULL,
	`count` integer NOT NULL
);
