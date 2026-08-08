CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`whatsapp_number` text NOT NULL,
	`amount` real NOT NULL,
	`period` text NOT NULL,
	`threshold_percent` integer DEFAULT 80,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`jid` text PRIMARY KEY NOT NULL,
	`name` text,
	`added_by` text NOT NULL,
	`is_active` integer DEFAULT true,
	`language` text DEFAULT 'id',
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`code` text PRIMARY KEY NOT NULL,
	`owner_whatsapp_number` text NOT NULL,
	`is_used` integer DEFAULT false,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `report_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`status` text DEFAULT 'pending',
	`file_path` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`whatsapp_id` text NOT NULL,
	`amount` real NOT NULL,
	`transaction_type` text NOT NULL,
	`category` text,
	`description` text,
	`logged_by` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`whatsapp_number` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`onboarding_step` text DEFAULT 'language',
	`is_active` integer DEFAULT false,
	`created_at` integer
);
