import { memo, useRef } from 'react';
import { parseHourlyData, formatDspDisplay, formatPackDisplay } from './utils';

const HOURS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, '0')}:00-${String(i + 1).padStart(2, '0')}:00`
);

const CUT_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

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

function CampaignTable({ campaign, onCutChange, showCutDropdown = false }) {
  const selectRef = useRef(null);
  const { clicks, conversions, stp } = parseHourlyData(campaign.hourlyData);

  const totalC      = clicks.reduce((a, b) => a + b, 0);
  const totalConv   = conversions.reduce((a, b) => a + b, 0);
  const totalSTP    = stp.reduce((a, b) => a + b, 0);
  const totalCR     = calcCR(totalConv, totalC);
  const totalStpCR  = calcCR(totalSTP, totalC);
  const crVals      = clicks.map((c, i) => calcCR(conversions[i], c));
  const stpCRVals   = clicks.map((c, i) => calcCR(stp[i], c));

  const cutVal = String(campaign.cut ?? '0');

  function handleCutChange(e) {
    const newValue = e.target.value;
    onCutChange(campaign, newValue, cutVal, selectRef.current);
  }

  const pubLink = `https://postback.v1mobi.com/v2/landingPage?id=${campaign.campaignId}&click=clickid`;
  const packLabel = formatPackDisplay(campaign.packname);
  const dsp = formatDspDisplay(campaign.dspName);
  const hasLink = campaign.links && campaign.links !== '-' && String(campaign.links).startsWith('http');

  return (
    <div className="campaign-block">
      <div className="metadata-section campaign-head">
        <div className="campaign-head-top">
          <div className="campaign-head-title">
            <h3>
              {campaign.productname && campaign.productname !== '-'
                ? campaign.productname
                : `Campaign ${campaign.campaignId}`}
            </h3>
            <div className="campaign-head-tags">
              {showCutDropdown ? (
                <label className="campaign-cut">
                  <span>CUT</span>
                  <select
                    ref={selectRef}
                    className="cut-dropdown"
                    value={cutVal}
                    data-current-value={cutVal}
                    onChange={handleCutChange}
                  >
                    {CUT_OPTIONS.map(v => (
                      <option key={v} value={String(v)}>{v}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="camp-tag">CUT {cutVal}</span>
              )}
              <span className="camp-tag">DSP {dsp}</span>
              <span className="camp-tag">ID {campaign.campaignId}</span>
              {campaign.pgname ? <span className="camp-tag">{campaign.pgname}</span> : null}
              {campaign.entity ? <span className="camp-tag">{campaign.entity}</span> : null}
              {packLabel ? <span className="camp-tag">{packLabel}</span> : null}
            </div>
          </div>
        </div>

        <div className="campaign-head-links">
          <div className="campaign-link-row">
            <span className="campaign-link-label">Link</span>
            {hasLink
              ? <a href={campaign.links} target="_blank" rel="noreferrer" className="clickable-link">{campaign.links}</a>
              : <span className="campaign-link-empty">{campaign.links || '—'}</span>}
          </div>
          <div className="campaign-link-row">
            <span className="campaign-link-label">Pub</span>
            <a href={pubLink} target="_blank" rel="noreferrer" className="clickable-link">{pubLink}</a>
          </div>
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

export default memo(CampaignTable);
