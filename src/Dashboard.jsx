import { useState, useEffect } from 'react';
import CampaignTable from './CampaignTable';
import DateExportModal from './DateExportModal';
import CutConfirmModal from './CutConfirmModal';
import {
  API_URL, PROBE_START, PROBE_END,
  formatDate, formatDateDisplay,
  groupDataByDate, exportAllCSV, exportDateWiseCSV, updateCutValue,
} from './utils';

async function apiFetch(start, end) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ startDate: start, endDate: end }),
    mode: 'cors',
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data ? [data] : []);
}

function offsetDate(base, days) {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export default function Dashboard({ onLogout }) {
  const [serverToday, setServerToday] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [activeFilter, setActiveFilter] = useState('today');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [dateMap, setDateMap]   = useState(new Map());
  const [rawData, setRawData]   = useState([]);
  const [selectedDSP, setSelectedDSP] = useState('all');
  const [showDateModal, setShowDateModal] = useState(false);
  const [cutModal, setCutModal] = useState(null);
  const [debugOutput, setDebugOutput] = useState('');

  async function fetchData(start, end) {
    if (!start || !end) return;
    setLoading(true);
    setError('');
    try {
      const arr = await apiFetch(start, end);
      setRawData(arr);
      setDateMap(groupDataByDate(arr));
      setSelectedDSP('all');
      setDebugOutput(
        `Range: ${start} → ${end}\nTotal records: ${arr.length}\nDSPs: ${[...new Set(arr.map(c => c.dspName))].join(', ')}\n\n` +
        JSON.stringify(arr, null, 2)
      );
    } catch (e) {
      setError(e.message);
      setDebugOutput(`Error: ${e.message}\n\n${e.stack || ''}`);
    } finally {
      setLoading(false);
    }
  }

  // On mount: probe full range to find the server's latest date, then load that day
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const all   = await apiFetch(PROBE_START, PROBE_END);
        const dates = all.map(c => c.date).filter(Boolean).sort();
        const latest = dates.length > 0 ? dates[dates.length - 1] : formatDate(new Date());

        setServerToday(latest);
        setStartDate(latest);
        setEndDate(latest);

        const arr = await apiFetch(latest, latest);
        setRawData(arr);
        setDateMap(groupDataByDate(arr));
        setDebugOutput(
          `Server today: ${latest}\nTotal records: ${arr.length}\nDSPs: ${[...new Set(arr.map(c => c.dspName))].join(', ')}\n\n` +
          JSON.stringify(arr, null, 2)
        );
      } catch (e) {
        setError(e.message);
        setDebugOutput(`Init error: ${e.message}`);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function applyQuickFilter(filter) {
    if (!serverToday) return;
    setActiveFilter(filter);
    let s, e;
    if      (filter === 'today')     { s = e = serverToday; }
    else if (filter === 'yesterday') { s = e = offsetDate(serverToday, -1); }
    else if (filter === '7days')     { s = offsetDate(serverToday, -6);  e = serverToday; }
    else if (filter === '1month')    { s = offsetDate(serverToday, -29); e = serverToday; }
    setStartDate(s);
    setEndDate(e);
    fetchData(s, e);
  }

  function handleView() {
    setActiveFilter(null);
    fetchData(startDate, endDate);
  }

  // Derive display data
  const allCampaigns = [];
  dateMap.forEach(group => group.forEach(c => allCampaigns.push(c)));
  const uniqueDSPs = [...new Set(allCampaigns.map(c => c.dspName).filter(Boolean))].sort();

  const filteredDateMap = new Map();
  dateMap.forEach((group, date) => {
    const filtered = [...group.values()].filter(
      c => selectedDSP === 'all' || c.dspName === selectedDSP
    );
    if (filtered.length > 0) filteredDateMap.set(date, filtered);
  });
  const sortedDates = [...filteredDateMap.keys()].sort();

  const exportDates = [...new Set(rawData.map(c => c.date).filter(Boolean))].sort();
  const showCutDropdown = Boolean(serverToday && startDate === serverToday && endDate === serverToday);

  function handleCutChange(campaign, newValue, oldValue, selectEl) {
    setCutModal({ campaign, newValue, oldValue, selectEl });
  }

  async function confirmCut() {
    const { campaign, newValue, selectEl } = cutModal;
    setCutModal(null);
    try {
      await updateCutValue(campaign.campaignId, campaign.links, newValue);
      if (selectEl) selectEl.setAttribute('data-current-value', newValue);
      alert('CUT value updated successfully!');
    } catch (e) {
      alert('Failed to update CUT value. Please try again.');
      if (selectEl) selectEl.value = selectEl.getAttribute('data-current-value') || String(campaign.cut ?? 0);
    }
  }

  function cancelCut() {
    if (cutModal?.selectEl) cutModal.selectEl.value = cutModal.oldValue;
    setCutModal(null);
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>📊 V1 Mobi Dashboard</h1>
        <button className="logout-button" onClick={onLogout}>Logout</button>
      </header>

      <section className="filters-section">
        <div className="date-filters">
          <div className="date-input-group">
            <label>Start Date:</label>
            <input type="date" className="date-input" value={startDate}
              onChange={e => { setStartDate(e.target.value); setActiveFilter(null); }} />
          </div>
          <div className="date-input-group">
            <label>End Date:</label>
            <input type="date" className="date-input" value={endDate}
              onChange={e => { setEndDate(e.target.value); setActiveFilter(null); }} />
          </div>
          <button className="view-button" onClick={handleView}>View</button>
        </div>

        <div className="quick-filters">
          {[['today','Today'],['yesterday','Yesterday'],['7days','7 Days'],['1month','1 Month']].map(([f, label]) => (
            <button key={f}
              className={`quick-filter-btn${activeFilter === f ? ' active' : ''}`}
              onClick={() => applyQuickFilter(f)}>{label}
            </button>
          ))}
        </div>

        {uniqueDSPs.length > 0 && (
          <div className="section-divider">
            <span className="section-label">Filter by DSP:</span>
            <div className="dsp-filters">
              <button className={`dsp-filter-btn${selectedDSP === 'all' ? ' active' : ''}`}
                onClick={() => setSelectedDSP('all')}>All</button>
              {uniqueDSPs.map(dsp => (
                <button key={dsp}
                  className={`dsp-filter-btn${selectedDSP === dsp ? ' active' : ''}`}
                  onClick={() => setSelectedDSP(dsp)}>{dsp}
                </button>
              ))}
            </div>
          </div>
        )}

        {allCampaigns.length > 0 && (
          <div className="section-divider">
            <span className="section-label">Export Data:</span>
            <div className="export-buttons">
              <button className="export-btn" onClick={() => exportAllCSV(allCampaigns)}>📥 Export All CSV</button>
              <button className="export-btn" onClick={() => setShowDateModal(true)}>📅 Export Date-Wise CSV</button>
            </div>
          </div>
        )}
      </section>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner" />
          <p>Loading data...</p>
        </div>
      )}

      {!loading && error && <div className="error-banner">{error}</div>}

      {!loading && !error && sortedDates.length === 0 && (
        <div className="empty-state">No data available for the selected date range.</div>
      )}

      {!loading && sortedDates.map(date => (
        <div key={date} className="date-section">
          <div className="date-header">
            <h2>📅 {formatDateDisplay(date)}</h2>
          </div>
          {filteredDateMap.get(date).map((campaign, i) => (
            <CampaignTable
              key={`${date}__${campaign.dspName}__${campaign.campaignId}__${i}`}
              campaign={campaign}
              onCutChange={handleCutChange}
              showCutDropdown={showCutDropdown}
            />
          ))}
        </div>
      ))}

      <details className="debug-panel">
        <summary>🔍 Debug: View API Response</summary>
        <div style={{ padding: 16 }}>
          <button className="view-button" style={{ marginBottom: 10 }}
            onClick={() => fetchData(startDate, endDate)}>Test API Connection</button>
          <pre className="debug-output">{debugOutput}</pre>
        </div>
      </details>

      {showDateModal && (
        <DateExportModal
          dates={exportDates}
          onConfirm={dates => { setShowDateModal(false); exportDateWiseCSV(rawData, dates); }}
          onClose={() => setShowDateModal(false)}
        />
      )}

      {cutModal && (
        <CutConfirmModal
          campaignId={cutModal.campaign.campaignId}
          oldValue={cutModal.oldValue}
          newValue={cutModal.newValue}
          onConfirm={confirmCut}
          onCancel={cancelCut}
        />
      )}
    </div>
  );
}
