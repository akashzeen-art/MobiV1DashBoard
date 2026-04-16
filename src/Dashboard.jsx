import { useState, useEffect } from 'react';
import CampaignTable from './CampaignTable';
import DateExportModal from './DateExportModal';
import CutConfirmModal from './CutConfirmModal';
import {
  API_URL, formatDate, formatDateDisplay,
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

function getLocalToday() {
  return formatDate(new Date());
}

export default function Dashboard({ onLogout }) {
  const localToday = getLocalToday();
  const [startDate, setStartDate] = useState(localToday);
  const [endDate, setEndDate] = useState(localToday);
  const [activeFilter, setActiveFilter] = useState('today');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateMap, setDateMap] = useState(new Map());
  const [rawData, setRawData] = useState([]);
  const [selectedDSP, setSelectedDSP] = useState('all');
  const [showDateModal, setShowDateModal] = useState(false);
  const [cutModal, setCutModal] = useState(null);
  const [debugOutput, setDebugOutput] = useState('');

  async function fetchData(start, end) {
    setLoading(true);
    setError('');
    try {
      const arr = await apiFetch(start, end);
      setRawData(arr);
      setDateMap(groupDataByDate(arr));
      setSelectedDSP('all');
      setDebugOutput(`=== API RESPONSE ===\nType: ${typeof arr}\nIs Array: ${Array.isArray(arr)}\nCount: ${arr.length}\n\n${JSON.stringify(arr, null, 2)}`);
    } catch (e) {
      setError(e.message);
      setDebugOutput(`Error: ${e.message}\n\n${e.stack || ''}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(localToday, localToday);
  }, []);

  function offsetDate(base, days) {
    const d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }

  function applyQuickFilter(filter) {
    setActiveFilter(filter);
    const base = localToday;
    let s, e;
    if (filter === 'today')          { s = e = base; }
    else if (filter === 'yesterday') { s = e = offsetDate(base, -1); }
    else if (filter === '7days')     { s = offsetDate(base, -6); e = base; }
    else if (filter === '1month')    { s = offsetDate(base, -29); e = base; }
    setStartDate(s);
    setEndDate(e);
    fetchData(s, e);
  }

  function handleView() {
    setActiveFilter(null);
    fetchData(startDate, endDate);
  }

  const allCampaigns = [];
  dateMap.forEach(group => group.forEach(c => allCampaigns.push(c)));
  const uniqueDSPs = [...new Set(allCampaigns.map(c => c.dspName).filter(Boolean))];

  const filteredDateMap = new Map();
  dateMap.forEach((group, date) => {
    const filtered = [...group.values()].filter(
      c => selectedDSP === 'all' || c.dspName === selectedDSP
    );
    if (filtered.length > 0) filteredDateMap.set(date, filtered);
  });
  const sortedDates = [...filteredDateMap.keys()].sort();

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

  const exportDates = [...new Set(rawData.map(c => c.date).filter(Boolean))].sort();

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
          {[['today', 'Today'], ['yesterday', 'Yesterday'], ['7days', '7 Days'], ['1month', '1 Month']].map(([f, label]) => (
            <button key={f} className={`quick-filter-btn${activeFilter === f ? ' active' : ''}`}
              onClick={() => applyQuickFilter(f)}>{label}</button>
          ))}
        </div>

        {uniqueDSPs.length > 0 && (
          <div className="section-divider">
            <span className="section-label">Filter by DSP:</span>
            <div className="dsp-filters">
              <button className={`dsp-filter-btn${selectedDSP === 'all' ? ' active' : ''}`}
                onClick={() => setSelectedDSP('all')}>All</button>
              {uniqueDSPs.map(dsp => (
                <button key={dsp} className={`dsp-filter-btn${selectedDSP === dsp ? ' active' : ''}`}
                  onClick={() => setSelectedDSP(dsp)}>{dsp}</button>
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

      {error && <div className="error-banner">{error}</div>}

      <details className="debug-panel">
        <summary>🔍 Debug: View API Response</summary>
        <div style={{ padding: 16 }}>
          <button className="view-button" style={{ marginBottom: 10 }}
            onClick={() => fetchData(startDate, endDate)}>Test API Connection</button>
          <pre className="debug-output">{debugOutput}</pre>
        </div>
      </details>

      {!loading && !error && sortedDates.length === 0 && (
        <div className="empty-state">No data available for the selected date range.</div>
      )}

      {sortedDates.map(date => (
        <div key={date} className="date-section">
          <div className="date-header"><h2>📅 {formatDateDisplay(date)}</h2></div>
          {filteredDateMap.get(date).map((campaign, i) => (
            <CampaignTable
              key={`${campaign.campaignId}_${campaign.links}_${i}`}
              campaign={campaign}
              onCutChange={handleCutChange}
            />
          ))}
        </div>
      ))}

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
