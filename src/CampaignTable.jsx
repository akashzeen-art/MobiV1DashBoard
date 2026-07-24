import { useRef } from 'react';
import { parseHourlyData, formatDspDisplay } from './utils';

const HOURS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, '0')}:00-${String(i + 1).padStart(2, '0')}:00`
);

function calcCR(conv, clicks) {
  return clicks > 0 ? ((conv / clicks) * 100).toFixed(2) : '0.00';
}

function DataRow({ label, total, values, isCR }) {
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{label}</td>
      <td style={{ fontWeight: 600, color: isCR ? '#667eea' : undefined, background: isCR ? '#f0f2ff' : undefined }}>
        {isCR ? `${total}%` : total}
      </td>
      {values.map((v, i) => (
        <td key={i} style={{ color: isCR ? '#667eea' : undefined, background: isCR ? '#f0f2ff' : undefined }}>
          {isCR ? `${v}%` : v}
        </td>
      ))}
    </tr>
  );
}

export default function CampaignTable({ campaign, onCutChange, showCutDropdown = false }) {
  const selectRef = useRef(null);
  const { clicks, conversions, stp } = parseHourlyData(campaign.hourlyData);

  const totalC      = clicks.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const totalSTP    = stp.reduce((a, b) => a + b, 0);
  const totalCR     = calcCR(totalConv, totalC);
  const totalStpCR  = calcCR(totalSTP, totalC);
  const crVals      = clicks.map((c, i) => calcCR(conversions[i], c));
  const stpCRVals   = clicks.map((c, i) => calcCR(stp[i], c));

  // cut comes from API as string e.g. "0", "10"
  const cutVal = String(campaign.cut ?? '0');

  function handleCutChange(e) {
    const newValue = e.target.value;
    const oldValue = selectRef.current.getAttribute('data-current-value') || cutVal;
    onCutChange(campaign, newValue, oldValue, selectRef.current);
  }

  const pubLink = `https://postback.v1mobi.com/v2/landingPage?id=${campaign.campaignId}&click=clickid`;

  return (
    <div className="campaign-block">
      <div className="metadata-section">
        <div className="metadata-item">
          <strong>DSP Name:</strong><span>{formatDspDisplay(campaign.dspName)}</span>
        </div>
        <div className="metadata-item">
          <strong>Campaign ID:</strong><span>{campaign.campaignId}</span>
        </div>
        <div className="metadata-item">
          <strong>Product:</strong><span>{campaign.productname}</span>
        </div>
        <div className="metadata-item">
          <strong>Links:</strong>
          {campaign.links !== '-' && campaign.links.startsWith('http')
            ? <a href={campaign.links} target="_blank" rel="noreferrer" className="clickable-link">{campaign.links}</a>
            : <span>{campaign.links}</span>}
        </div>
        {showCutDropdown && (
          <div className="metadata-item">
            <strong>CUT:</strong>
            <select
              ref={selectRef}
              className="cut-dropdown"
              defaultValue={cutVal}
              data-current-value={cutVal}
              onChange={handleCutChange}
            >
              {[0, 10, 20, 30].map(v => <option key={v} value={String(v)}>{v}</option>)}
            </select>
          </div>
        )}
        <div className="metadata-item">
          <strong>Pub Link:</strong>
          <a href={pubLink} target="_blank" rel="noreferrer" className="clickable-link">{pubLink}</a>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Hour</th>
              <th>Total</th>
              {HOURS.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            <DataRow label="Clicks"     total={totalC}     values={clicks}      />
            <DataRow label="Conversion" total={totalConv}  values={conversions} />
            <DataRow label="CR"         total={totalCR}    values={crVals}      isCR />
            <DataRow label="STP"        total={totalSTP}   values={stp}         />
            <DataRow label="STP CR"     total={totalStpCR} values={stpCRVals}   isCR />
          </tbody>
        </table>
      </div>
    </div>
  );
}
