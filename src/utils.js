export const API_URL = 'https://postback.v1mobi.com/postbacks/hourlyReport';
export const UPDATE_CUT_API = 'https://postback.v1mobi.com/postbacks/updateCut';

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

export function parseHourlyData(hourlyData) {
  const clicks = new Array(24).fill(0);
  const conversions = new Array(24).fill(0);
  const stp = new Array(24).fill(0);
  (hourlyData || []).forEach(item => {
    const match = String(item.hour ?? '').trim().match(/^(\d{1,2}):\d{2}/);
    if (!match) return;
    const h = parseInt(match[1], 10);
    if (h < 0 || h >= 24) return;
    clicks[h] += parseInt(item.clicks ?? item.click ?? item.Clicks ?? 0, 10) || 0;
    conversions[h] += parseInt(item.conversions ?? item.conversion ?? item.Conversions ?? 0, 10) || 0;
    stp[h] += parseInt(item.stp ?? item.STP ?? item.sendToPartner ?? 0, 10) || 0;
  });
  return { clicks, conversions, stp };
}

export function groupDataByDate(data) {
  const dateMap = new Map();
  const items = Array.isArray(data) ? data : (data ? [data] : []);
  items.forEach(campaign => {
    const date = campaign.date || 'unknown';
    const key = `${campaign.dspName}_${campaign.campaignId}_${campaign.links}`;
    if (!dateMap.has(date)) dateMap.set(date, new Map());
    const group = dateMap.get(date);
    if (!group.has(key)) {
      group.set(key, {
        dspName: campaign.dspName || '-',
        campaignId: campaign.campaignId || '-',
        links: campaign.links || '-',
        productname: campaign.productname || '-',
        date,
        cut: campaign.cut ?? 0,
        hourlyData: [],
      });
    }
    if (Array.isArray(campaign.hourlyData)) {
      group.get(key).hourlyData.push(...campaign.hourlyData);
    }
  });
  return dateMap;
}

function escapeCSV(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function hourHeaders() {
  return Array.from({ length: 24 }, (_, i) =>
    `${String(i).padStart(2, '0')}:00-${String(i + 1).padStart(2, '0')}:00`
  ).join(',');
}

function buildCSVRows(campaign) {
  const { clicks, conversions, stp } = parseHourlyData(campaign.hourlyData);
  const totalC = clicks.reduce((a, b) => a + b, 0);
  const totalConv = conversions.reduce((a, b) => a + b, 0);
  const totalSTP = stp.reduce((a, b) => a + b, 0);
  const totalCR = totalC > 0 ? ((totalConv / totalC) * 100).toFixed(2) : '0.00';
  const totalStpCR = totalC > 0 ? ((totalSTP / totalC) * 100).toFixed(2) : '0.00';
  const d = escapeCSV(campaign.dspName);
  const id = escapeCSV(campaign.campaignId);
  const l = escapeCSV(campaign.links);
  const row = (label, total, vals) => `${d},${id},${l},${label},${total},${vals.join(',')}\n`;
  const crVals = clicks.map((c, i) => c > 0 ? ((conversions[i] / c) * 100).toFixed(2) + '%' : '0.00%');
  const stpCRVals = clicks.map((c, i) => c > 0 ? ((stp[i] / c) * 100).toFixed(2) + '%' : '0.00%');
  return (
    row('Clicks', totalC, clicks) +
    row('Conversion', totalConv, conversions) +
    row('CR', totalCR + '%', crVals) +
    row('STP', totalSTP, stp) +
    row('STP CR', totalStpCR + '%', stpCRVals)
  );
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename, style: 'display:none' });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportAllCSV(campaigns) {
  let csv = `DSP Name,Campaign ID,Links,Metric,Total,${hourHeaders()}\n`;
  campaigns.forEach(c => { csv += buildCSVRows(c); });
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
    let csv = `Date: ${date}\nDSP Name,Campaign ID,Links,Metric,Total,${hourHeaders()}\n`;
    grouped.forEach(group => group.forEach(c => { csv += buildCSVRows(c); }));
    downloadCSV(csv, `dashboard_${date}.csv`);
    count++;
  });
  if (count > 1) alert(`Exported ${count} CSV files.`);
}

export async function updateCutValue(campaignId, links, cutValue) {
  const res = await fetch(UPDATE_CUT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ campaignId, links, cut: parseInt(cutValue, 10) }),
    mode: 'cors',
  });
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
  return res.json();
}
