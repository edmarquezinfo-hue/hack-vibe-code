/**
 * Analytics Controller Types
 * Type definitions for analytics controller requests and responses
 */

import { UserAnalyticsData, ChatAnalyticsData } from '../../../services/analytics/types';

/**
 * Query parameters for analytics requests
 */
export interface AnalyticsQueryParams {
  days?: string; // Number of days to query (default: 1)
}

/**
 * Route parameters for user analytics
 */
export interface UserAnalyticsParams {
  id: string; // User ID
}

/**
 * Route parameters for agent analytics
 */
export interface AgentAnalyticsParams {
  id: string; // Agent/Chat ID
}

/**
 * User analytics response data
 */
export interface UserAnalyticsResponseData extends UserAnalyticsData {}

/**
 * Agent analytics response data
 */
export interface AgentAnalyticsResponseData extends ChatAnalyticsData {}

/**
 * Analytics error response
 */
export interface AnalyticsErrorResponse {
  message: string;
  code: string;
  statusCode: number;
}