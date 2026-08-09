CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`whatsapp_number` text NOT NULL,
	`ip` text,
	`action` text NOT NULL,
	`created_at` integer
);
