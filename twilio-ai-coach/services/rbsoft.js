/**
 * RBsoft SMS Gateway Service
 *
 * Handles communication with RBsoft SMS Gateway API for sending SMS,
 * managing devices, and receiving delivery status webhooks.
 */

const https = require('https');
const http = require('http');

class RBsoftService {
  /**
   * Create an RBsoft service instance
   * @param {string} apiUrl - Base URL for the RBsoft API
   * @param {string} apiKey - API key for authentication
   */
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl?.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Make an HTTP request to the RBsoft API
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} Response data
   */
  async request(method, endpoint, data = null) {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('RBsoft API URL and API key are required');
    }

    const url = new URL(endpoint, this.apiUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = httpModule.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const response = body ? JSON.parse(body) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              const error = new Error(response.message || response.error || `HTTP ${res.statusCode}`);
              error.statusCode = res.statusCode;
              error.response = response;
              reject(error);
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Test connection to the RBsoft API
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      // Try to get device list as a connection test
      const result = await this.getDevices();
      return {
        success: true,
        message: 'Connection successful',
        deviceCount: Array.isArray(result) ? result.length : 0
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Connection failed',
        error: error.statusCode || 'UNKNOWN'
      };
    }
  }

  /**
   * Get list of available devices
   * @returns {Promise<Array>} List of devices
   */
  async getDevices() {
    return this.request('GET', '/devices');
  }

  /**
   * Get status of a specific device
   * @param {string} deviceId - RBsoft device ID
   * @returns {Promise<Object>} Device status
   */
  async getDeviceStatus(deviceId) {
    return this.request('GET', `/devices/${deviceId}/status`);
  }

  /**
   * Send an SMS message via a specific device
   * @param {string} deviceId - RBsoft device ID
   * @param {string} to - Recipient phone number
   * @param {string} message - Message body
   * @param {Object} options - Additional options (mediaUrl, etc.)
   * @returns {Promise<Object>} Send result with message ID
   */
  async sendSMS(deviceId, to, message, options = {}) {
    const data = {
      device: deviceId,
      number: to,
      message: message,
      ...(options.mediaUrl && { mediaUrl: options.mediaUrl }),
      ...(options.scheduledFor && { scheduledFor: options.scheduledFor })
    };

    return this.request('POST', '/messages/send', data);
  }

  /**
   * Get message delivery status
   * @param {string} messageId - RBsoft message ID
   * @returns {Promise<Object>} Message status
   */
  async getMessageStatus(messageId) {
    return this.request('GET', `/messages/${messageId}/status`);
  }

  /**
   * Get call log from a device
   * @param {string} deviceId - RBsoft device ID
   * @param {Object} options - Query options (since, limit, etc.)
   * @returns {Promise<Array>} Call log entries
   */
  async getCallLog(deviceId, options = {}) {
    const params = new URLSearchParams();
    if (options.since) params.set('since', options.since);
    if (options.limit) params.set('limit', options.limit);
    if (options.offset) params.set('offset', options.offset);

    const queryString = params.toString();
    const endpoint = `/devices/${deviceId}/calls${queryString ? '?' + queryString : ''}`;
    return this.request('GET', endpoint);
  }

  /**
   * Get inbox messages from a device
   * @param {string} deviceId - RBsoft device ID
   * @param {Object} options - Query options (since, limit, etc.)
   * @returns {Promise<Array>} Inbox messages
   */
  async getInbox(deviceId, options = {}) {
    const params = new URLSearchParams();
    if (options.since) params.set('since', options.since);
    if (options.limit) params.set('limit', options.limit);
    if (options.offset) params.set('offset', options.offset);

    const queryString = params.toString();
    const endpoint = `/devices/${deviceId}/inbox${queryString ? '?' + queryString : ''}`;
    return this.request('GET', endpoint);
  }

  /**
   * Register a webhook URL for delivery status updates
   * @param {string} webhookUrl - URL to receive webhook callbacks
   * @param {Array<string>} events - Events to subscribe to
   * @returns {Promise<Object>} Webhook registration result
   */
  async registerWebhook(webhookUrl, events = ['message.sent', 'message.delivered', 'message.failed', 'message.received']) {
    return this.request('POST', '/webhooks', {
      url: webhookUrl,
      events: events
    });
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Signature from webhook header
   * @param {string} secret - Webhook secret
   * @returns {boolean} Whether signature is valid
   */
  static verifyWebhookSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

/**
 * RBsoft rate limiter for per-device rate limiting
 */
class RBsoftRateLimiter {
  constructor() {
    // Map of deviceId -> { count, resetAt }
    this.limits = new Map();
    // Default: 10 messages per minute per device
    this.defaultLimit = 10;
    this.windowMs = 60000; // 1 minute
  }

  /**
   * Check if a device can send a message (does not increment counter)
   * @param {string} deviceId - Device ID to check
   * @param {number} limit - Optional per-device limit override
   * @returns {boolean} Whether the device can send
   */
  canSend(deviceId, limit = this.defaultLimit) {
    const now = Date.now();
    const record = this.limits.get(deviceId);

    if (!record || now >= record.resetAt) {
      // Window expired or first request - can send
      return true;
    }

    // Check if under the limit
    return record.count < limit;
  }

  /**
   * Record that a message was sent
   * @param {string} deviceId - Device ID
   */
  recordSent(deviceId) {
    const now = Date.now();
    const record = this.limits.get(deviceId);

    if (!record || now >= record.resetAt) {
      this.limits.set(deviceId, { count: 1, resetAt: now + this.windowMs });
    } else {
      record.count++;
    }
  }

  /**
   * Get remaining capacity for a device
   * @param {string} deviceId - Device ID
   * @param {number} limit - Optional per-device limit
   * @returns {number} Remaining messages allowed
   */
  getRemaining(deviceId, limit = this.defaultLimit) {
    const now = Date.now();
    const record = this.limits.get(deviceId);

    if (!record || now >= record.resetAt) {
      return limit;
    }

    return Math.max(0, limit - record.count);
  }

  /**
   * Get time until rate limit resets
   * @param {string} deviceId - Device ID
   * @returns {number} Milliseconds until reset, or 0 if not limited
   */
  getResetIn(deviceId) {
    const now = Date.now();
    const record = this.limits.get(deviceId);

    if (!record || now >= record.resetAt) {
      return 0;
    }

    return record.resetAt - now;
  }
}

/**
 * Device load balancer for distributing messages across devices
 */
class RBsoftLoadBalancer {
  constructor(rateLimiter) {
    this.rateLimiter = rateLimiter;
    this.lastUsedIndex = -1;
  }

  /**
   * Select the next available device using round-robin with rate limit awareness
   * @param {Array} devices - Array of device objects with id and is_active properties
   * @returns {Object|null} Selected device or null if none available
   */
  selectDevice(devices) {
    const activeDevices = devices.filter(d => d.is_active && d.status !== 'offline');

    if (activeDevices.length === 0) {
      return null;
    }

    // Try round-robin, skipping rate-limited devices
    for (let i = 0; i < activeDevices.length; i++) {
      const index = (this.lastUsedIndex + 1 + i) % activeDevices.length;
      const device = activeDevices[index];

      if (this.rateLimiter.canSend(device.device_id)) {
        this.lastUsedIndex = index;
        return device;
      }
    }

    // All devices rate limited - return the one that resets soonest
    let soonestDevice = activeDevices[0];
    let soonestReset = this.rateLimiter.getResetIn(soonestDevice.device_id);

    for (const device of activeDevices.slice(1)) {
      const resetIn = this.rateLimiter.getResetIn(device.device_id);
      if (resetIn < soonestReset) {
        soonestReset = resetIn;
        soonestDevice = device;
      }
    }

    return soonestDevice;
  }
}

module.exports = {
  RBsoftService,
  RBsoftRateLimiter,
  RBsoftLoadBalancer
};
