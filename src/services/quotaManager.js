import { Mutex } from '../state/mutex.js';
import { state, saveStateToFile } from '../state/botState.js';
import config from '../../config.js';

const quotaMutex = new Mutex();
const requestTimestamps = [];

/**
 * Ensures that the bot respects Google's API quota limits (RPM and RPD).
 * Blocks execution if RPM is reached until a slot is available.
 * Throws an error if RPD is reached.
 */
export async function waitForQuota() {
  const limits = config.quotaLimits;
  if (!limits) return;

  const { maxRequestsPerMinute, maxRequestsPerDay } = limits;

  return await quotaMutex.runExclusive(async () => {
    // 1. Check Daily Limit (RPD)
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (!state.quotaUsage || state.quotaUsage.date !== today) {
      state.quotaUsage = { date: today, count: 0 };
    }

    if (maxRequestsPerDay && state.quotaUsage.count >= maxRequestsPerDay) {
      const error = new Error('Daily quota limit reached.');
      error.status = 'RESOURCE_EXHAUSTED';
      throw error;
    }

    // 2. Check Minute Limit (RPM)
    const oneMinuteAgo = Date.now() - 60000;
    
    // Cleanup old timestamps
    while (requestTimestamps.length > 0 && requestTimestamps[0] <= oneMinuteAgo) {
      requestTimestamps.shift();
    }

    if (maxRequestsPerMinute && requestTimestamps.length >= maxRequestsPerMinute) {
      const oldest = requestTimestamps[0];
      const waitTime = 60000 - (Date.now() - oldest) + 500; // Add 500ms buffer
      
      if (waitTime > 0) {
        console.log(`Quota limit reached (${requestTimestamps.length} RPM). Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // After waiting, we MUST re-evaluate because we might still be over limit 
        // if multiple requests were queued.
        // However, since we are inside runExclusive, we are the only one re-checking.
        // But the timestamps array might have been cleared by time passing.
        
        // Re-run the RPM check logic
        return await _checkRpmAndRegister(maxRequestsPerMinute);
      }
    }

    // Register request
    requestTimestamps.push(Date.now());
    state.quotaUsage.count += 1;
    saveStateToFile();
  });
}

/** Internal helper for recursive RPM check after waiting */
async function _checkRpmAndRegister(maxRequestsPerMinute) {
  const oneMinuteAgo = Date.now() - 60000;
  while (requestTimestamps.length > 0 && requestTimestamps[0] <= oneMinuteAgo) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= maxRequestsPerMinute) {
    const oldest = requestTimestamps[0];
    const waitTime = 60000 - (Date.now() - oldest) + 500;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return await _checkRpmAndRegister(maxRequestsPerMinute);
    }
  }

  requestTimestamps.push(Date.now());
  state.quotaUsage.count += 1;
  saveStateToFile();
}
