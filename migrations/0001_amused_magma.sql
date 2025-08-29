CREATE TABLE `user_model_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_action_name` text NOT NULL,
	`model_name` text,
	`max_tokens` integer,
	`temperature` real,
	`reasoning_effort` text,
	`provider_override` text,
	`fallback_model` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_model_configs_user_agent_idx` ON `user_model_configs` (`user_id`,`agent_action_name`);--> statement-breakpoint
CREATE INDEX `user_model_configs_user_idx` ON `user_model_configs` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_model_configs_is_active_idx` ON `user_model_configs` (`is_active`);--> statement-breakpoint
CREATE TABLE `user_provider_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`key_preview` text NOT NULL,
	`last_tested` integer,
	`test_status` text,
	`test_error` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_provider_keys_user_provider_idx` ON `user_provider_keys` (`user_id`,`provider`);--> statement-breakpoint
CREATE INDEX `user_provider_keys_user_idx` ON `user_provider_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_provider_keys_provider_idx` ON `user_provider_keys` (`provider`);--> statement-breakpoint
CREATE INDEX `user_provider_keys_is_active_idx` ON `user_provider_keys` (`is_active`);--> statement-breakpoint
CREATE INDEX `user_provider_keys_test_status_idx` ON `user_provider_keys` (`test_status`);