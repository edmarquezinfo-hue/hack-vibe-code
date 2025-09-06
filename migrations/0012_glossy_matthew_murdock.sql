DROP TABLE `app_categories`;--> statement-breakpoint
DROP TABLE `app_tags`;--> statement-breakpoint
DROP TABLE `board_members`;--> statement-breakpoint
-- DROP TABLE `boards`;--> statement-breakpoint
DROP TABLE `cloudflare_accounts`;--> statement-breakpoint
DROP TABLE `team_members`;--> statement-breakpoint
DROP TABLE `teams`;--> statement-breakpoint
DROP TABLE `user_provider_keys`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon_url` text,
	`original_prompt` text NOT NULL,
	`final_prompt` text,
	`blueprint` text,
	`framework` text,
	`user_id` text,
	`session_token` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`deployment_url` text,
	`github_repository_url` text,
	`github_repository_visibility` text,
	`is_archived` integer DEFAULT false,
	`is_featured` integer DEFAULT false,
	`version` integer DEFAULT 1,
	`parent_app_id` text,
	`screenshot_url` text,
	`screenshot_captured_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	`last_deployed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_apps`("id", "title", "description", "icon_url", "original_prompt", "final_prompt", "blueprint", "framework", "user_id", "session_token", "visibility", "status", "deployment_url", "github_repository_url", "github_repository_visibility", "is_archived", "is_featured", "version", "parent_app_id", "screenshot_url", "screenshot_captured_at", "created_at", "updated_at", "last_deployed_at") SELECT "id", "title", "description", "icon_url", "original_prompt", "final_prompt", "blueprint", "framework", "user_id", "session_token", "visibility", "status", "deployment_url", "github_repository_url", "github_repository_visibility", "is_archived", "is_featured", "version", "parent_app_id", "screenshot_url", "screenshot_captured_at", "created_at", "updated_at", "last_deployed_at" FROM `apps`;--> statement-breakpoint
DROP TABLE `apps`;--> statement-breakpoint
ALTER TABLE `__new_apps` RENAME TO `apps`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `apps_user_idx` ON `apps` (`user_id`);--> statement-breakpoint
CREATE INDEX `apps_status_idx` ON `apps` (`status`);--> statement-breakpoint
CREATE INDEX `apps_visibility_idx` ON `apps` (`visibility`);--> statement-breakpoint
CREATE INDEX `apps_session_token_idx` ON `apps` (`session_token`);--> statement-breakpoint
CREATE INDEX `apps_parent_app_idx` ON `apps` (`parent_app_id`);--> statement-breakpoint
CREATE INDEX `apps_search_idx` ON `apps` (`title`,`description`);--> statement-breakpoint
CREATE INDEX `apps_framework_status_idx` ON `apps` (`framework`,`status`);--> statement-breakpoint
CREATE INDEX `apps_visibility_status_idx` ON `apps` (`visibility`,`status`);--> statement-breakpoint
CREATE INDEX `apps_created_at_idx` ON `apps` (`created_at`);--> statement-breakpoint
CREATE INDEX `apps_updated_at_idx` ON `apps` (`updated_at`);--> statement-breakpoint
ALTER TABLE `user_secrets` DROP COLUMN `environment`;