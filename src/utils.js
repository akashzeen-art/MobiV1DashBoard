export const API_URL = 'https://postback.v1mobi.com/postbacks/hourlyReport';
export const OPTIMIZE_CUT_API = 'https://postback.v1mobi.com/optimize';
export const SERVICES_API = 'https://postback.v1mobi.com/v2/getallService';
export const UPDATE_SERVICE_API = 'https://postback.v1mobi.com/v2/updateService';
export const ADD_SERVICE_API = 'https://postback.v1mobi.com/v2/addService';
export const UPDATE_TRAFFIC_API = 'https://postback.v1mobi.com/v2/updateTrafficConfig';

/** How many calendar months to offer in Month-Wise export (no API probe needed) */
export const EXPORT_MONTH_COUNT = 24;

const REPORTS_CACHE_KEY = 'v1mobi_reports_today_d2c_v2';

/** Last N months as YYYY-MM, newest first */
export function listRecentMonths(count = EXPORT_MONTH_COUNT) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export async function fetchHourlyReport(start, end) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ startDate: start, endDate: end }),
    mode: 'cors',
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data ? [data] : []);
  // Reports page: only D2C campaigns
  return list.filter(item => String(item?.type ?? '').trim().toLowerCase() === 'd2c');
}

function offsetDateStr(base, days) {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** Load cached "today" snapshot for instant paint on refresh */
export function readReportsCache() {
  try {
    const raw = sessionStorage.getItem(REPORTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.serverToday || !Array.isArray(parsed.rawData)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeReportsCache({ serverToday, rawData }) {
  try {
    sessionStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify({
      serverToday,
      rawData,
      savedAt: Date.now(),
    }));
  } catch {
    // quota / private mode — ignore
  }
}

export function clearReportsCache() {
  try { sessionStorage.removeItem(REPORTS_CACHE_KEY); } catch { /* ignore */ }
}

/**
 * Fastest init path: fetch client today only; if empty, try yesterday.
 * Returns { latest, dayData }.
 */
export async function fetchLatestDayReport() {
  const today = formatDate(new Date());
  const todayData = await fetchHourlyReport(today, today);
  if (todayData.length > 0) {
    return { latest: today, dayData: todayData };
  }
  const yesterday = offsetDateStr(today, -1);
  const yData = await fetchHourlyReport(yesterday, yesterday);
  if (yData.length > 0) {
    return { latest: yesterday, dayData: yData };
  }
  return { latest: today, dayData: [] };
}

/** Shared in-flight prefetch so App can start the request before Dashboard mounts */
let reportsPrefetch = null;

export function prefetchReportsToday() {
  if (!reportsPrefetch) {
    reportsPrefetch = fetchLatestDayReport()
      .then(result => {
        writeReportsCache({ serverToday: result.latest, rawData: result.dayData });
        return result;
      })
      .catch(err => {
        reportsPrefetch = null;
        throw err;
      });
  }
  return reportsPrefetch;
}

export function consumeReportsPrefetch() {
  const p = reportsPrefetch;
  reportsPrefetch = null;
  return p;
}


// Publisher full name → DSP letter code
export const PUBLISHER_CODES = {
  olimib: 'A',
  afflink: 'B',
  mobibox: 'C',
  bladslive: 'D',
};

// DSP letter code → publisher full name
export const CODE_TO_PUBLISHER = {
  A: 'Olimib',
  B: 'Afflink',
  C: 'Mobibox',
  D: 'BladsLive',
};

/** "Olimib" → "A"; unknown publishers stay as-is */
export function formatPublisherDisplay(publisher) {
  if (!publisher || publisher === '-') return publisher || '-';
  const code = PUBLISHER_CODES[String(publisher).trim().toLowerCase()];
  return code || publisher;
}

/** "A" → "A"; known codes stay as code only; unknown stay as-is */
export function formatDspDisplay(dsp) {
  if (!dsp || dsp === '-') return dsp || '-';
  return String(dsp).trim();
}

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateDisplay(dateString) {
  if (!dateString) return dateString;
  try {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateString; }
}

/** packname comes as "{\"monthly\":99}" → "monthly: 99" */
export function formatPackDisplay(pack) {
  const v = String(pack ?? '').trim();
  if (!v) return '';
  try {
    const obj = JSON.parse(v);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.entries(obj).map(([k, val]) => `${k}: ${val}`).join(', ');
    }
  } catch { /* show raw */ }
  return v;
}

// API returns sparse hourlyData — only hours with activity
// hour format: "12:00-13:00" → extract start hour index
export function parseHourlyData(hourlyData) {
  const clicks      = new Array(24).fill(0);
  const conversions = new Array(24).fill(0);
  const stp         = new Array(24).fill(0);

  (hourlyData || []).forEach(item => {
    const match = String(item.hour ?? '').trim().match(/^(\d{1,2}):\d{2}/);
    if (!match) return;
    const h = parseInt(match[1], 10);
    if (h < 0 || h >= 24) return;
    clicks[h]      += parseInt(item.clicks      ?? item.click  ?? item.Clicks      ?? 0, 10) || 0;
    conversions[h] += parseInt(item.conversions ?? item.conversion ?? item.Conversions ?? 0, 10) || 0;
    stp[h]         += parseInt(item.stp         ?? item.STP   ?? item.sendToPartner ?? 0, 10) || 0;
  });

  return { clicks, conversions, stp };
}

/** Overall CR % for a campaign: (conversions / clicks) × 100 */
export function campaignCR(campaign) {
  const { clicks, conversions } = parseHourlyData(campaign?.hourlyData);
  const totalC = clicks.reduce((a, b) => a + b, 0);
  const totalConv = conversions.reduce((a, b) => a + b, 0);
  return totalC > 0 ? (totalConv / totalC) * 100 : 0;
}

// Group ALL DSP data by date → campaign
export function groupDataByDate(data) {
  const dateMap = new Map();
  const items = Array.isArray(data) ? data : (data ? [data] : []);

  items.forEach(campaign => {
    const date = campaign.date || 'unknown';
    // Unique key per date+dsp+campaign+link so same campaign on different dates stays separate
    const key = `${date}__${campaign.dspName}__${campaign.campaignId}__${campaign.links}`;

    if (!dateMap.has(date)) dateMap.set(date, new Map());
    const group = dateMap.get(date);

    if (!group.has(key)) {
      group.set(key, {
        dspName:     campaign.dspName     || '-',
        campaignId:  String(campaign.campaignId || '-'),
        links:       campaign.links       || '-',
        productname: campaign.productname || '-',
        pgname:      campaign.pgname      || '',
        entity:      campaign.entity      || '',
        packname:    campaign.packname || campaign.pack || '',
        publisher:   campaign.publisher   || '',
        type:        campaign.type        || '',
        date,
        cut:         String(campaign.cut ?? '0'),
        hourlyData:  [],
      });
    }

    if (Array.isArray(campaign.hourlyData)) {
      group.get(key).hourlyData.push(...campaign.hourlyData);
    }
  });

  return dateMap;
}

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCSV(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function hourHeaders() {
  return Array.from({ length: 24 }, (_, i) =>
    `${String(i).padStart(2, '0')}:00-${String(i + 1).padStart(2, '0')}:00`
  ).join(',');
}

// One nicely-spaced block per campaign:
// info rows → metric table header → 5 metric rows → blank gap row
function buildCampaignBlock(campaign) {
  const { clicks, conversions, stp } = parseHourlyData(campaign.hourlyData);
  const totalC    = clicks.reduce((a, b) => a + b, 0);
  const totalConv = conversions.reduce((a, b) => a + b, 0);
  const totalSTP  = stp.reduce((a, b) => a + b, 0);
  const totalCR     = totalC > 0 ? ((totalConv / totalC) * 100).toFixed(2) : '0.00';
  const totalStpCR  = totalC > 0 ? ((totalSTP  / totalC) * 100).toFixed(2) : '0.00';

  const crVals    = clicks.map((c, i) => c > 0 ? ((conversions[i] / c) * 100).toFixed(2) + '%' : '0.00%');
  const stpCRVals = clicks.map((c, i) => c > 0 ? ((stp[i]         / c) * 100).toFixed(2) + '%' : '0.00%');

  const row = (label, total, vals) => `${label},${total},${vals.join(',')}\n`;

  let block = '';
  block += `DSP Name:,${escapeCSV(formatDspDisplay(campaign.dspName))},,Campaign ID:,${escapeCSV(campaign.campaignId)}`;
  if (campaign.productname && campaign.productname !== '-') {
    block += `,,Product:,${escapeCSV(campaign.productname)}`;
  }
  block += '\n';
  if (campaign.pgname) block += `PG Name:,${escapeCSV(campaign.pgname)}`;
  if (campaign.entity) block += `${campaign.pgname ? ',,' : ''}Entity:,${escapeCSV(campaign.entity)}`;
  if (campaign.pgname || campaign.entity) block += '\n';
  if (campaign.packname) block += `Pack:,${escapeCSV(formatPackDisplay(campaign.packname))}\n`;
  block += `Links:,${escapeCSV(campaign.links)}\n`;
  block += `Metric,Total,${hourHeaders()}\n`;
  block += row('Clicks',     totalC,    clicks);
  block += row('Conversion', totalConv, conversions);
  block += row('CR',         totalCR  + '%', crVals);
  block += row('STP',        totalSTP,  stp);
  block += row('STP CR',     totalStpCR + '%', stpCRVals);
  block += '\n';
  return block;
}

function sectionBanner(title) {
  return `\n${'='.repeat(60)}\n${escapeCSV(title)}\n${'='.repeat(60)}\n\n`;
}

function reportHeader(reportTitle, metaRows = []) {
  let head = `V1 MOBI DASHBOARD,${escapeCSV(reportTitle)}\n`;
  head += `Generated:,${new Date().toLocaleString('en-US')}\n`;
  metaRows.forEach(([label, value]) => { head += `${label},${escapeCSV(value)}\n`; });
  head += '\n';
  return head;
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: filename, style: 'display:none',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportAllCSV(campaigns) {
  const dates = [...new Set(campaigns.map(c => c.date).filter(Boolean))].sort();
  const range = dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : (dates[0] || '-');

  let csv = reportHeader('All Data Report', [
    ['Date Range:', range],
    ['Total Campaigns:', campaigns.length],
  ]);

  // Group campaign blocks under their date so days are clearly separated
  dates.forEach(date => {
    csv += sectionBanner(`DATE: ${formatDateDisplay(date)}`);
    campaigns.filter(c => c.date === date).forEach(c => { csv += buildCampaignBlock(c); });
  });

  // Campaigns without a date (fallback)
  const undated = campaigns.filter(c => !c.date);
  if (undated.length > 0) {
    csv += sectionBanner('DATE: Unknown');
    undated.forEach(c => { csv += buildCampaignBlock(c); });
  }

  downloadCSV(csv, `dashboard_${formatDate(new Date())}.csv`);
}

export function exportDateWiseCSV(rawData, selectedDates) {
  const dateMap = new Map();
  rawData.forEach(c => {
    const d = c.date || '';
    if (!dateMap.has(d)) dateMap.set(d, []);
    dateMap.get(d).push(c);
  });

  let count = 0;
  dateMap.forEach((campaigns, date) => {
    if (selectedDates && !selectedDates.includes(date)) return;
    const grouped = groupDataByDate(campaigns);

    let totalCampaigns = 0;
    grouped.forEach(group => { totalCampaigns += group.size; });

    let csv = reportHeader('Date-Wise Report', [
      ['Date:', formatDateDisplay(date)],
      ['Total Campaigns:', totalCampaigns],
    ]);
    grouped.forEach(group => group.forEach(c => { csv += buildCampaignBlock(c); }));
    downloadCSV(csv, `dashboard_${date}.csv`);
    count++;
  });

  if (count > 1) alert(`Exported ${count} CSV files.`);
}

export function formatMonthDisplay(month) {
  // month = "2026-07" → "July 2026"
  try {
    return new Date(month + '-01T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long',
    });
  } catch { return month; }
}

// One CSV per month: month summary (all days combined) + per-date breakdown
export function exportMonthCSV(rawData, month) {
  const grouped = groupDataByDate(rawData);
  const sortedDates = [...grouped.keys()].sort();

  // Month summary — same campaign merged across all days of the month
  const summary = new Map();
  rawData.forEach(campaign => {
    const key = `${campaign.dspName}__${campaign.campaignId}__${campaign.links}`;
    if (!summary.has(key)) {
      summary.set(key, {
        dspName:     campaign.dspName || '-',
        campaignId:  String(campaign.campaignId || '-'),
        links:       campaign.links || '-',
        productname: campaign.productname || '-',
        pgname:      campaign.pgname || '',
        entity:      campaign.entity || '',
        packname:    campaign.packname || campaign.pack || '',
        publisher:   campaign.publisher || '',
        hourlyData:  [],
      });
    }
    if (Array.isArray(campaign.hourlyData)) {
      summary.get(key).hourlyData.push(...campaign.hourlyData);
    }
  });

  let csv = reportHeader('Month-Wise Report', [
    ['Month:', formatMonthDisplay(month)],
    ['Days With Data:', sortedDates.length],
    ['Total Campaigns:', summary.size],
  ]);

  csv += sectionBanner('MONTH SUMMARY (All Days Combined)');
  summary.forEach(c => { csv += buildCampaignBlock(c); });

  sortedDates.forEach(date => {
    csv += sectionBanner(`DATE: ${formatDateDisplay(date)}`);
    grouped.get(date).forEach(c => { csv += buildCampaignBlock(c); });
  });

  downloadCSV(csv, `dashboard_month_${month}.csv`);
}

function resolveCutId(campaignId, links) {
  if (links && links.includes('id=')) {
    const match = links.match(/[?&]id=(\d+)/);
    if (match) return match[1];
  }
  return campaignId;
}

export async function updateCutValue(campaignId, links, cutValue) {
  const id = resolveCutId(campaignId, links);
  const url = `${OPTIMIZE_CUT_API}?id=${encodeURIComponent(id)}&cut=${encodeURIComponent(cutValue)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    mode: 'cors',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error: ${res.status} ${res.statusText}. ${errorText}`);
  }

  const responseText = await res.text();
  if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
    try {
      return JSON.parse(responseText);
    } catch {
      return { success: true, message: responseText || 'CUT updated successfully' };
    }
  }
  return { success: true, message: responseText || 'CUT updated successfully' };
}

// traffic_config comes as JSON string, empty string, or null
// e.g. "{\"80\":50,\"19\":30,\"91\":20}" → [{ id: "80", percent: 50 }, ...]
export function parseTrafficConfig(raw) {
  if (raw == null || raw === '') return [];
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.entries(obj)
      .map(([id, percent]) => ({ id: String(id), percent: Number(percent) || 0 }))
      .filter(e => e.percent > 0)
      .sort((a, b) => b.percent - a.percent);
  } catch {
    return [];
  }
}

/** Build API string: {"80":50,"19":30,"91":20} — ids as keys, percents as numbers */
export function buildTrafficConfigString(rows) {
  const obj = {};
  (rows || []).forEach(({ id, percent }) => {
    const pid = String(id ?? '').trim();
    const pct = Number(percent);
    if (!pid || !Number.isFinite(pct) || pct <= 0) return;
    obj[pid] = Math.round(pct);
  });
  return JSON.stringify(obj);
}

export async function updateTrafficConfig(serviceId, trafficConfigString) {
  const res = await fetch(UPDATE_TRAFFIC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      id: Number(serviceId),
      traffic_config: trafficConfigString,
    }),
    mode: 'cors',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error: ${res.status} ${res.statusText}. ${errorText}`);
  }

  const responseText = await res.text();
  if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
    try {
      return JSON.parse(responseText);
    } catch {
      return { success: true, message: responseText || 'Traffic config updated' };
    }
  }
  return { success: true, message: responseText || 'Traffic config updated' };
}

/** Pack is stored as a JSON string, e.g. "{\"monthly\":99}" */
export function normalizePack(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  try {
    const parsed = JSON.parse(v);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.stringify(parsed);
    }
  } catch {
    // plain number or text → {"monthly":99}
  }
  if (/^\d+(\.\d+)?$/.test(v)) return JSON.stringify({ monthly: Number(v) });
  return JSON.stringify({ monthly: v });
}

/** traffic_config is a JSON string or null, e.g. "{\"91\":20,\"122\":80}" */
export function normalizeTrafficConfig(raw) {
  if (raw == null || raw === '') return null;
  let obj = raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s || s === '{}') return null;
    try { obj = JSON.parse(s); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const compact = {};
  Object.entries(obj).forEach(([id, percent]) => {
    const pct = Number(percent);
    if (!id || !Number.isFinite(pct) || pct <= 0) return;
    compact[String(id)] = Math.round(pct);
  });
  return Object.keys(compact).length ? JSON.stringify(compact) : null;
}

async function nextServiceId() {
  const res = await fetch(SERVICES_API, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    mode: 'cors',
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data ? [data] : []);
  const ids = list.map(s => Number(s.id)).filter(n => Number.isFinite(n));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

/**
 * Exact /addService + /updateService body:
 * { id, servicename, pgname, entity, pack, serviceurl, targeturl, publisher, optimization, type, traffic_config }
 */
export function buildServiceBody(service) {
  return {
    id: Number(service.id),
    servicename: String(service.servicename || ''),
    pgname: String(service.pgname || ''),
    entity: String(service.entity || ''),
    pack: normalizePack(service.pack),
    serviceurl: String(service.serviceurl || ''),
    targeturl: String(service.targeturl || ''),
    publisher: !service.publisher || service.publisher === '-' ? '' : String(service.publisher),
    optimization: Number(service.optimization ?? 0),
    type: String(service.type || 'd2c'),
    traffic_config: normalizeTrafficConfig(service.traffic_config),
  };
}

async function postService(url, method, body, okMessage) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    mode: 'cors',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error: ${res.status} ${res.statusText}. ${errorText}`);
  }

  const responseText = await res.text();
  if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
    try {
      return JSON.parse(responseText);
    } catch {
      return { success: true, message: responseText || okMessage };
    }
  }
  return { success: true, message: responseText || okMessage, body };
}

/** Add → POST /v2/addService; Edit → PUT /v2/updateService. Same body shape. */
export async function saveService(service) {
  const isEdit = service.id != null && service.id !== '';
  const body = buildServiceBody({
    ...service,
    id: isEdit ? service.id : await nextServiceId(),
  });
  if (isEdit) {
    return postService(UPDATE_SERVICE_API, 'PUT', body, 'Service updated');
  }
  return postService(ADD_SERVICE_API, 'POST', body, 'Service added');
}

export const addService = saveService;
export const updateService = saveService;

export async function fetchServices() {
  const res = await fetch(SERVICES_API, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    mode: 'cors',
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data ? [data] : []);
  // Services page: only D2C
  return list
    .filter(s => String(s?.type ?? '').trim().toLowerCase() === 'd2c')
    .map(s => ({
      id: Number(s.id),
      servicename: s.servicename || '-',
      pgname: s.pgname || '',
      entity: s.entity || '',
      pack: s.pack || '',
      serviceurl: s.serviceurl || '',
      targeturl: s.targeturl || '',
      publisher: s.publisher || '-',
      optimization: Number(s.optimization ?? 0),
      type: s.type || '-',
      traffic_config: s.traffic_config ?? null,
      trafficRoutes: parseTrafficConfig(s.traffic_config),
    }));
}
