CREATE TABLE `otp_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`whatsapp_number` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`is_used` integer DEFAULT false,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `web_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_number` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer
);
