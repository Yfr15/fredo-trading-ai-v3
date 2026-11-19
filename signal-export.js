'use strict';

// Stable, read-only signal envelope for future adapters.
// This module deliberately contains no broker credentials or execution code.
function buildSignalEnvelope(snapshot, generatedAt=Date.now()) {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('A market snapshot is required');
  const action = snapshot.stale ? 'WAIT' : (['UP','DOWN'].includes(snapshot.signal) ? snapshot.signal : 'WAIT');
  return {
    schema: 'fredo.signal.v1',
    generatedAt,
    market: {
      symbol: snapshot.symbol,
      source: snapshot.source,
      mode: snapshot.mode,
      candleTime: snapshot.lastUpdate,
      ageMs: snapshot.ageMs,
      stale: Boolean(snapshot.stale)
    },
    decision: {
      action,
      reason: snapshot.reason || 'No decision reason supplied',
      indicators: snapshot.indicators || {}
    },
    execution: {
      enabled: false,
      mode: 'READ_ONLY',
      broker: null,
      orderSubmitted: false
    }
  };
}
module.exports = { buildSignalEnvelope };
