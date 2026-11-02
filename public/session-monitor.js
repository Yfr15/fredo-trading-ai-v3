'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const KEY = 'fredo-ai-trader-sessions-v1';
  let sessions = [];
  try { sessions = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(sessions)) sessions = []; } catch { sessions = []; }
  let active = sessions.find(s => s.active) || null;
  const money = n => (n < 0 ? '-$' : '$') + Math.abs(Number(n || 0)).toFixed(2);
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(sessions.slice(-40))); } catch {} };
  const signalNow = () => {
    const s = ($('signal')?.textContent || 'WAIT').trim().toUpperCase();
    return ['UP','DOWN'].includes(s) ? s : 'WAIT';
  };
  function totals(s) {
    const trades = s.trades || [];
    const wins = trades.filter(t => t.outcome === 'WIN').length;
    const losses = trades.filter(t => t.outcome === 'LOSS').length;
    const ties = trades.filter(t => t.outcome === 'TIE').length;
    const aligned = trades.filter(t => t.poDecision !== 'WAIT' && t.fredoSignal !== 'WAIT' && t.poDecision === t.fredoSignal).length;
    return { count: trades.length, wins, losses, ties, aligned };
  }
  function render() {
    const s = active;
    $('session-state').textContent = s ? 'SESSION ACTIVE' : 'NO ACTIVE SESSION';
    $('session-start').disabled = !!s;
    $('session-end').disabled = !s;
    $('session-log').disabled = !s;
    $('session-emergency').disabled = !s;
    $('session-start-balance').disabled = !!s;
    $('session-end-balance').disabled = !s;
    $('session-pnl').textContent = s && Number.isFinite(Number(s.endBalance))
      ? money(Number(s.endBalance) - Number(s.startBalance)) : s ? 'In progress' : '—';
    const t = s ? totals(s) : {count:0,wins:0,losses:0,ties:0,aligned:0};
    $('session-count').textContent = t.count;
    $('session-record').textContent = t.wins + 'W · ' + t.losses + 'L · ' + t.ties + 'T';
    $('session-alignment').textContent = t.count ? t.aligned + '/' + t.count : '—';
    $('session-balance-label').textContent = s ? 'Start ' + money(s.startBalance) : 'Enter starting balance';
    $('session-trades').innerHTML = s && s.trades.length ? s.trades.slice().reverse().slice(0,12).map(t =>
      '<div class="trade-row"><b>' + t.time + '</b><span>PO ' + t.poDecision + '</span><span>Fredo ' + t.fredoSignal + '</span><span>' + t.outcome + '</span></div>'
    ).join('') : 'No decisions logged in this session yet.';
    $('session-history').innerHTML = sessions.filter(x => !x.active).slice().reverse().slice(0,8).map(x => {
      const z = totals(x), pnl = Number.isFinite(Number(x.endBalance)) ? money(Number(x.endBalance)-Number(x.startBalance)) : 'Not recorded';
      return '<div class="trade-row"><b>' + new Date(x.startedAt).toLocaleDateString() + '</b><span>' + z.count + ' trades</span><span>' + z.wins + 'W · ' + z.losses + 'L</span><span>' + pnl + '</span></div>';
    }).join('') || 'Completed sessions will appear here.';
  }
  $('session-start').addEventListener('click', () => {
    const startBalance = Number($('session-start-balance').value);
    if (!Number.isFinite(startBalance) || startBalance < 0) { $('session-message').textContent = 'Enter a valid starting balance.'; return; }
    active = { id: Date.now(), startedAt: Date.now(), startBalance, endBalance: null, active: true, trades: [] };
    sessions.push(active); persist(); $('session-message').textContent = 'Session tracking started. This does not start Pocket Option AI Trader.'; render();
  });
  $('session-log').addEventListener('click', () => {
    if (!active) return;
    const poDecision = $('session-po-decision').value;
    const fredoSignal = $('session-fredo-signal').value === 'CURRENT' ? signalNow() : $('session-fredo-signal').value;
    const outcome = $('session-outcome').value;
    active.trades.push({ time: new Date().toLocaleTimeString(), poDecision, fredoSignal, outcome, symbol: $('symbol')?.value || 'Unknown' });
    persist(); $('session-message').textContent = 'Decision recorded locally on this device.'; render();
  });
  function finish(emergency) {
    if (!active) return;
    const endBalance = Number($('session-end-balance').value);
    if (!emergency && (!Number.isFinite(endBalance) || endBalance < 0)) { $('session-message').textContent = 'Enter a valid ending balance before ending the session.'; return; }
    active.endBalance = emergency ? null : endBalance;
    active.active = false; active.endedAt = Date.now(); active.emergencyStopped = !!emergency;
    active = null; persist();
    $('session-message').textContent = emergency ? 'Tracker stopped. This does not stop or control Pocket Option.' : 'Session saved on this device.';
    render();
  }
  $('session-end').addEventListener('click', () => finish(false));
  $('session-emergency').addEventListener('click', () => finish(true));
  $('session-fredo-signal').addEventListener('change', () => {
    if ($('session-fredo-signal').value === 'CURRENT') $('session-fredo-preview').textContent = signalNow();
    else $('session-fredo-preview').textContent = $('session-fredo-signal').value;
  });
  setInterval(() => { if ($('session-fredo-signal').value === 'CURRENT') $('session-fredo-preview').textContent = signalNow(); }, 1000);
  render();
})();