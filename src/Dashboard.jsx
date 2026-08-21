import { useState, useEffect, useMemo, useCallback, memo, startTransition } from 'react';
import CampaignTable from './CampaignTable';
import DateExportModal from './DateExportModal';
import MonthExportModal from './MonthExportModal';
import CutConfirmModal from './CutConfirmModal';
import {
  formatDate, formatDateDisplay, formatDspDisplay,
  groupDataByDate, exportAllCSV, exportDateWiseCSV, exportMonthCSV, updateCutValue,
  listRecentMonths, campaignCR,
  fetchHourlyReport,
  readReportsCache,
  writeReportsCache,
  consumeReportsPrefetch,
  prefetchReportsToday,
  fetchLatestDayReport,
} from './utils';

function offsetDate(base, days) {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function debugSummary(start, end, arr, extra = '') {
  const dsps = [...new Set(arr.map(c => c.dspName).filter(Boolean))].join(', ');
  return `${extra}Range: ${start} → ${end}\nTotal records: ${arr.length}\nDSPs: ${dsps || '(none)'}`;
}

const BATCH = 6;

const DateSection = memo(function DateSection({ date, campaigns, onCutChange, showCutDropdown, limit }) {
  const shown = limit == null ? campaigns : campaigns.slice(0, limit);
  return (
    <div className="date-section">
      <div className="date-header">
        <h2>📅 {formatDateDisplay(date)}</h2>
      </div>
      {shown.map((campaign, i) => (
        <CampaignTable
          key={`${date}__${campaign.dspName}__${campaign.campaignId}__${i}`}
          campaign={campaign}
          onCutChange={onCutChange}
          showCutDropdown={showCutDropdown}
        />
      ))}
    </div>
  );
});

function hydrateFromCache() {
  const cached = readReportsCache();
  if (!cached) {
    return {
      serverToday: '',
      startDate: '',
      endDate: '',
      rawData: [],
      dateMap: new Map(),
      hasCache: false,
    };
  }
  return {
    serverToday: cached.serverToday,
    startDate: cached.serverToday,
    endDate: cached.serverToday,
    rawData: cached.rawData,
    dateMap: groupDataByDate(cached.rawData),
    hasCache: cached.rawData.length > 0,
  };
}

export default function Dashboard({ onLogout, onNavigate }) {
  const initial = useMemo(() => hydrateFromCache(), []);

  const [serverToday, setServerToday] = useState(initial.serverToday);
  const [startDate, setStartDate]     = useState(initial.startDate);
  const [endDate, setEndDate]         = useState(initial.endDate);
  const [activeFilter, setActiveFilter] = useState('today');
  const [loading, setLoading]   = useState(!initial.hasCache);
  const [refreshing, setRefreshing] = useState(initial.hasCache);
  const [error, setError]       = useState('');
  const [dateMap, setDateMap]   = useState(initial.dateMap);
  const [rawData, setRawData]   = useState(initial.rawData);
  const [selectedDSP, setSelectedDSP] = useState('all');
  const [showDateModal, setShowDateModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [allMonths] = useState(() => listRecentMonths());
  const [exporting, setExporting] = useState(false);
  const [cutModal, setCutModal] = useState(null);
  const [debugOutput, setDebugOutput] = useState(
    initial.hasCache
      ? debugSummary(initial.serverToday, initial.serverToday, initial.rawData, 'Cached snapshot\n')
      : ''
  );
  const [rawDebugJson, setRawDebugJson] = useState('');
  const [paintCount, setPaintCount] = useState(BATCH);

  function applyDayResult(latest, dayData, note = '') {
    startTransition(() => {
      setServerToday(latest);
      setStartDate(latest);
      setEndDate(latest);
      setActiveFilter('today');
      setRawData(dayData);
      setDateMap(groupDataByDate(dayData));
      setSelectedDSP('all');
      setPaintCount(BATCH);
      setDebugOutput(debugSummary(latest, latest, dayData, note));
      setRawDebugJson('');
      setError('');
    });
    writeReportsCache({ serverToday: latest, rawData: dayData });
  }

  async function fetchData(start, end, { soft = false } = {}) {
    if (!start || !end) return;
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    setRawDebugJson('');
    try {
      const arr = await fetchHourlyReport(start, end);
      startTransition(() => {
        setRawData(arr);
        setDateMap(groupDataByDate(arr));
        setSelectedDSP('all');
        setPaintCount(BATCH);
        setDebugOutput(debugSummary(start, end, arr));
      });
      if (start === end && serverToday && start === serverToday) {
        writeReportsCache({ serverToday: start, rawData: arr });
      }
    } catch (e) {
      setError(e.message);
      setDebugOutput(`Error: ${e.message}\n\n${e.stack || ''}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Instant cache paint + background revalidate (uses App prefetch when available)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const hasCache = initial.hasCache;
      if (!hasCache) setLoading(true);
      else setRefreshing(true);

      try {
        const pending = consumeReportsPrefetch() || prefetchReportsToday();
        const { latest, dayData } = await pending;
        if (cancelled) return;
        applyDayResult(latest, dayData, 'Live refresh\n');
      } catch (e) {
        if (cancelled) return;
        if (!hasCache) {
          try {
            const { latest, dayData } = await fetchLatestDayReport();
            if (cancelled) return;
            applyDayResult(latest, dayData, 'Live refresh\n');
          } catch (err) {
            if (!cancelled) {
              setError(err.message);
              setDebugOutput(`Init error: ${err.message}`);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { uniqueDSPs, filteredDateMap, sortedDates, allCampaigns, filteredTotal } = useMemo(() => {
    const campaigns = [];
    dateMap.forEach(group => group.forEach(c => campaigns.push(c)));
    const dsps = [...new Set(campaigns.map(c => c.dspName).filter(Boolean))].sort();

    const filtered = new Map();
    let filteredCount = 0;
    dateMap.forEach((group, date) => {
      const list = [...group.values()]
        .filter(c => selectedDSP === 'all' || c.dspName === selectedDSP)
        .sort((a, b) => campaignCR(b) - campaignCR(a)); // max CR → min CR
      if (list.length > 0) {
        filtered.set(date, list);
        filteredCount += list.length;
      }
    });

    return {
      allCampaigns: campaigns,
      uniqueDSPs: dsps,
      filteredDateMap: filtered,
      sortedDates: [...filtered.keys()].sort(),
      filteredTotal: filteredCount,
    };
  }, [dateMap, selectedDSP]);

  useEffect(() => {
    setPaintCount(BATCH);
  }, [selectedDSP]);

  // Progressive campaign paint — keeps first paint smooth
  useEffect(() => {
    if (paintCount >= filteredTotal) return undefined;
    const id = requestAnimationFrame(() => {
      setPaintCount(c => Math.min(c + BATCH, filteredTotal));
    });
    return () => cancelAnimationFrame(id);
  }, [paintCount, filteredTotal]);

  // How many campaign cards to show across dates (progressive)
  const dateLimits = useMemo(() => {
    const limits = new Map();
    let remaining = paintCount;
    for (const date of sortedDates) {
      const list = filteredDateMap.get(date) || [];
      const take = Math.min(list.length, remaining);
      limits.set(date, take);
      remaining -= take;
    }
    return limits;
  }, [sortedDates, filteredDateMap, paintCount]);

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

  const exportDates = useMemo(
    () => [...new Set(rawData.map(c => c.date).filter(Boolean))].sort(),
    [rawData]
  );
  const showCutDropdown = Boolean(serverToday && startDate === serverToday && endDate === serverToday);

  const handleCutChange = useCallback((campaign, newValue, oldValue, selectEl) => {
    setCutModal({ campaign, newValue, oldValue, selectEl });
  }, []);

  function applyCutToState(campId, cutStr, sourceData) {
    const patchedRaw = (sourceData || rawData).map(c =>
      String(c.campaignId) === campId ? { ...c, cut: cutStr } : c
    );
    setRawData(patchedRaw);
    setDateMap(groupDataByDate(patchedRaw));
    if (serverToday) {
      writeReportsCache({
        serverToday,
        rawData: patchedRaw.filter(c => c.date === serverToday),
      });
    }
  }

  async function confirmCut() {
    const { campaign, newValue } = cutModal;
    setCutModal(null);
    const cutStr = String(newValue);
    const campId = String(campaign.campaignId);
    try {
      // Landing-page camp id: https://postback.v1mobi.com/v2/landingPage?id={campaignId}
      await updateCutValue(campId, cutStr);

      // Immediate UI update
      applyCutToState(campId, cutStr);

      // Soft reload and keep the new CUT (report API can lag)
      if (startDate && endDate) {
        setRefreshing(true);
        setError('');
        try {
          const arr = await fetchHourlyReport(startDate, endDate);
          const patched = arr.map(c =>
            String(c.campaignId) === campId ? { ...c, cut: cutStr } : c
          );
          startTransition(() => {
            setRawData(patched);
            setDateMap(groupDataByDate(patched));
            setPaintCount(BATCH);
            setDebugOutput(debugSummary(startDate, endDate, patched, `CUT ${campId} → ${cutStr}%\n`));
          });
          if (startDate === endDate && serverToday && startDate === serverToday) {
            writeReportsCache({ serverToday: startDate, rawData: patched });
          }
        } finally {
          setRefreshing(false);
          setLoading(false);
        }
      }
    } catch (e) {
      alert(`Failed to update CUT: ${e.message || 'Please try again.'}`);
    }
  }

  function cancelCut() {
    setCutModal(null);
  }

  async function handleMonthExport(months) {
    setShowMonthModal(false);
    setExporting(true);
    let exported = 0;
    const failed = [];
    for (const month of months) {
      try {
        const [y, m] = month.split('-').map(Number);
        const monthStart = `${month}-01`;
        const monthEnd = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
        const arr = await fetchHourlyReport(monthStart, monthEnd);
        if (arr.length === 0) { failed.push(`${month} (no data)`); continue; }
        exportMonthCSV(arr, month);
        exported++;
      } catch (e) {
        failed.push(`${month} (${e.message})`);
      }
    }
    setExporting(false);
    if (failed.length > 0) {
      alert(`Exported ${exported} month CSV file(s).\nSkipped: ${failed.join(', ')}`);
    } else if (exported > 1) {
      alert(`Exported ${exported} month CSV files.`);
    }
  }

  function loadRawDebug() {
    if (rawDebugJson) return;
    try {
      setRawDebugJson(JSON.stringify(rawData, null, 2));
    } catch {
      setRawDebugJson('(Could not serialize response)');
    }
  }

  const showBlockingLoader = loading && !allCampaigns.length;
  const paintedDates = sortedDates.filter(d => (dateLimits.get(d) || 0) > 0);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>📊 V1 Mobi Dashboard</h1>
          <nav className="app-nav">
            <button className="nav-btn active">Reports</button>
            <button className="nav-btn" onClick={() => onNavigate?.('services')}>Services</button>
          </nav>
        </div>
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
          <button className="view-button" onClick={handleView} disabled={loading || refreshing}>View</button>
        </div>

        <div className="quick-filters">
          {[['today','Today'],['yesterday','Yesterday'],['7days','7 Days'],['1month','1 Month']].map(([f, label]) => (
            <button key={f}
              className={`quick-filter-btn${activeFilter === f ? ' active' : ''}`}
              disabled={!serverToday || loading}
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
                  onClick={() => setSelectedDSP(dsp)}>{formatDspDisplay(dsp)}
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
              <button className="export-btn" disabled={exporting}
                onClick={() => setShowMonthModal(true)}>
                {exporting ? '⏳ Exporting...' : '🗓️ Export Month-Wise CSV'}
              </button>
            </div>
          </div>
        )}
      </section>

      {refreshing && (
        <div className="refresh-banner" aria-live="polite">
          <div className="spinner spinner-sm" />
          <span>Updating latest data…</span>
        </div>
      )}

      {showBlockingLoader && (
        <div className="loading-indicator">
          <div className="spinner" />
          <p>Loading data...</p>
        </div>
      )}

      {!showBlockingLoader && error && !allCampaigns.length && (
        <div className="error-banner">{error}</div>
      )}

      {!showBlockingLoader && !error && sortedDates.length === 0 && !refreshing && (
        <div className="empty-state">No data available for the selected date range.</div>
      )}

      {!showBlockingLoader && paintedDates.map(date => (
        <DateSection
          key={date}
          date={date}
          campaigns={filteredDateMap.get(date)}
          onCutChange={handleCutChange}
          showCutDropdown={showCutDropdown}
          limit={dateLimits.get(date)}
        />
      ))}

      {!showBlockingLoader && paintCount < filteredTotal && (
        <div className="refresh-banner">
          <div className="spinner spinner-sm" />
          <span>Showing {paintCount} of {filteredTotal} campaigns…</span>
        </div>
      )}

      <details className="debug-panel" onToggle={e => e.currentTarget.open && loadRawDebug()}>
        <summary>🔍 Debug: View API Response</summary>
        <div style={{ padding: 16 }}>
          <button className="view-button" style={{ marginBottom: 10 }}
            onClick={() => fetchData(startDate, endDate)}>Test API Connection</button>
          <pre className="debug-output">{debugOutput}{rawDebugJson ? `\n\n${rawDebugJson}` : '\n\n(Open panel to load raw JSON)'}</pre>
        </div>
      </details>

      {showDateModal && (
        <DateExportModal
          dates={exportDates}
          onConfirm={dates => { setShowDateModal(false); exportDateWiseCSV(rawData, dates); }}
          onClose={() => setShowDateModal(false)}
        />
      )}

      {showMonthModal && (
        <MonthExportModal
          months={allMonths}
          onConfirm={handleMonthExport}
          onClose={() => setShowMonthModal(false)}
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
