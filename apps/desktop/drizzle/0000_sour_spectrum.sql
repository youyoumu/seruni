CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`noteId` integer NOT NULL,
	`fileName` text NOT NULL,
	`type` text NOT NULL,
	`vadData` text DEFAULT 'null',
	FOREIGN KEY (`noteId`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`noteId` integer NOT NULL,
	`info` text DEFAULT 'null'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notes_noteId_unique` ON `notes` (`noteId`);