CREATE TABLE IF NOT EXISTS `active_sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `market_limits` (
	`provider` text PRIMARY KEY NOT NULL,
	`window_id` integer NOT NULL,
	`count` integer NOT NULL
);
