export type ChannelBridgeResult = {
  success?: boolean;
  error?: string;
  message?: string;
};

/**
 * Channel enable/disable endpoints may return HTTP 200 with success: false in data.
 * Callers must treat that as failure — see WANd.WECOM.ENABLE.001.
 */
export function assertChannelBridgeSuccess(data: unknown): void {
  if (!data || typeof data !== 'object') {
    return;
  }
  const result = data as ChannelBridgeResult;
  if (result.success === false) {
    throw new Error(result.error || 'Channel operation failed');
  }
}
