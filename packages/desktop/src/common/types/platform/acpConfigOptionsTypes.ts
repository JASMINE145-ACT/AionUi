/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * ACP config-options API types — aligned with AionCore `aionui-api-types::acp`.
 * JSON field `type` maps to Rust `option_type` via serde rename.
 */

/** A single select option inside an ACP config option. */
export interface AcpConfigSelectOptionDto {
  value: string;
  name?: string;
  label?: string;
  description?: string;
}

/** Frontend-facing ACP config option (snake_case field names). */
export interface AcpConfigOptionDto {
  id: string;
  /** JSON field name "type" (Rust `option_type`). */
  type: string;
  name?: string;
  label?: string;
  description?: string;
  category?: string;
  current_value?: string;
  options: AcpConfigSelectOptionDto[];
}

export type ConfigOptionConfirmation = 'observed' | 'command_ack';

export interface GetConfigOptionsResponse {
  config_options: AcpConfigOptionDto[];
}

export interface SetConfigOptionRequest {
  value: string;
}

export interface SetConfigOptionResponse {
  confirmation: ConfigOptionConfirmation;
  config_options?: AcpConfigOptionDto[];
}
