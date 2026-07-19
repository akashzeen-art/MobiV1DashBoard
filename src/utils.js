export const API_URL = 'https://postback.v1mobi.com/postbacks/hourlyReport';
export const OPTIMIZE_CUT_API = 'https://postback.v1mobi.com/optimize';
export const PROBE_START = '2024-01-01';
export const PROBE_END = '2027-12-31';

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
  block += `DSP Name:,${escapeCSV(campaign.dspName)},,Campaign ID:,${escapeCSV(campaign.campaignId)}`;
  if (campaign.productname && campaign.productname !== '-') {
    block += `,,Product:,${escapeCSV(campaign.productname)}`;
  }
  block += '\n';
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
