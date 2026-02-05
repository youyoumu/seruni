CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`note_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`type` text NOT NULL,
	`vad_data` text DEFAULT 'null',
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`note_id` integer NOT NULL,
	`info` text DEFAULT 'null'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notes_note_id_unique` ON `notes` (`note_id`);--> statement-breakpoint
CREATE TABLE `text_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`text` text NOT NULL
);
