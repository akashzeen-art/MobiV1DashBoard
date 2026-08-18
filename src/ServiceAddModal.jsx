import { useMemo, useState } from 'react';
import {
  formatPublisherDisplay,
  listDspOptions,
  buildTrafficConfigString,
} from './utils';

const CUT_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const PCTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

let rowKey = 0;
function nextKey() {
  rowKey += 1;
  return rowKey;
}

export default function ServiceAddModal({ allServices, onSave, onClose }) {
  const [servicename, setServicename] = useState('');
  const [pgname, setPgname] = useState('');
  const [entity, setEntity] = useState('');
  const [pack, setPack] = useState('');
  const [publisher, setPublisher] = useState('');
  const [serviceurl, setServiceurl] = useState('');
  const [targeturl, setTargeturl] = useState('');
  const [optimization, setOptimization] = useState(0);
  const [trafficRows, setTrafficRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const services = useMemo(
    () => [...allServices].sort((a, b) => a.id - b.id),
    [allServices]
  );
  const dspOptions = useMemo(() => listDspOptions(allServices), [allServices]);

  const total = trafficRows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
  const usedIds = new Set(trafficRows.map(r => String(r.id)).filter(Boolean));
  const noTraffic = trafficRows.length === 0;
  const isOver = !noTraffic && total > 100;
  const trafficOk = noTraffic || total === 100;
  const nameOk = servicename.trim().length > 0;
  const urlOk = serviceurl.trim().length > 0;
  const canSave = !saving && trafficOk && !isOver && nameOk && urlOk;

  function updateTraffic(key, patch) {
    setTrafficRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setError('');
  }

  function addBox() {
    setTrafficRows(prev => {
      if (prev.length === 0) {
        return [{ key: nextKey(), id: '', percent: 100 }];
      }
      if (prev.length === 1 && Number(prev[0].percent) === 100) {
        return [
          { ...prev[0], percent: 50 },
          { key: nextKey(), id: '', percent: 50 },
        ];
      }
      const sum = prev.reduce((s, r) => s + (Number(r.percent) || 0), 0);
      return [...prev, { key: nextKey(), id: '', percent: Math.max(0, 100 - sum) }];
    });
    setError('');
  }

  function removeBox(key) {
    setTrafficRows(prev => prev.filter(r => r.key !== key));
    setError('');
  }

  function removeAllTraffic() {
    setTrafficRows([]);
    setError('');
  }

  function buildPayload() {
    const traffic_config = noTraffic ? '' : buildTrafficConfigString(trafficRows);
    return {
      servicename: servicename.trim(),
      pgname: pgname.trim(),
      entity: entity.trim(),
      pack: pack.trim(),
      publisher,
      serviceurl: serviceurl.trim(),
      targeturl: targeturl.trim(),
      optimization: Number(optimization),
      type: 'd2c',
      traffic_config,
    };
  }

  function requestSave() {
    if (!nameOk) {
      setError('Enter a service name.');
      return;
    }
    if (!urlOk) {
      setError('Enter a service URL.');
      return;
    }
    if (!noTraffic) {
      if (trafficRows.some(r => !r.id)) {
        setError('Select Camp ID in every traffic box.');
        return;
      }
      if (new Set(trafficRows.map(r => r.id)).size !== trafficRows.length) {
        setError('Duplicate Camp ID in traffic.');
        return;
      }
      if (total !== 100) {
        setError(`Traffic total must be 100%. Now ${total}%.`);
        return;
      }
    }
    setError('');
    setShowConfirm(true);
  }

  async function confirmSave() {
    setSaving(true);
    setError('');
    try {
      await onSave(buildPayload());
    } catch (e) {
      setError(e.message || 'Add failed.');
      setShowConfirm(false);
      setSaving(false);
      return;
    }
    setSaving(false);
    setShowConfirm(false);
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
        <div className="modal-content service-edit-modal" role="dialog" aria-labelledby="svc-add-title">
          <div className="modal-header">
            <h2 id="svc-add-title">Add Service</h2>
            <span className="modal-close" onClick={() => !saving && onClose()}>&times;</span>
          </div>

          <div className="modal-body service-edit-body">
            <div className="svc-edit-field">
              <label>Service Name</label>
              <input
                className="svc-edit-input"
                value={servicename}
                placeholder="e.g. flavr"
                onChange={e => { setServicename(e.target.value); setError(''); }}
              />
            </div>

            <div className="svc-edit-grid">
              <div className="svc-edit-field">
                <label>PG Name</label>
                <input
                  className="svc-edit-input"
                  value={pgname}
                  placeholder="PG name"
                  onChange={e => setPgname(e.target.value)}
                />
              </div>
              <div className="svc-edit-field">
                <label>Entity</label>
                <input
                  className="svc-edit-input"
                  value={entity}
                  placeholder="Entity"
                  onChange={e => setEntity(e.target.value)}
                />
              </div>
              <div className="svc-edit-field">
                <label>Pack</label>
                <input
                  className="svc-edit-input"
                  value={pack}
                  placeholder='{"monthly":99}'
                  onChange={e => setPack(e.target.value)}
                />
              </div>
              <div className="svc-edit-field">
                <label>DSP</label>
                <select
                  className="cut-dropdown"
                  value={publisher}
                  onChange={e => setPublisher(e.target.value)}
                >
                  <option value="">—</option>
                  {dspOptions.map(opt => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="svc-edit-info" style={{ marginTop: 0 }}>
              <div><span>Type</span><strong>d2c</strong></div>
            </div>

            <div className="svc-edit-field">
              <label>Service URL</label>
              <textarea
                className="svc-edit-textarea"
                rows={2}
                value={serviceurl}
                placeholder="https://…"
                onChange={e => { setServiceurl(e.target.value); setError(''); }}
              />
            </div>

            <div className="svc-edit-field">
              <label>CUT</label>
              <select
                className="cut-dropdown"
                value={String(optimization)}
                onChange={e => setOptimization(Number(e.target.value))}
              >
                {CUT_OPTIONS.map(v => (
                  <option key={v} value={String(v)}>{v}%</option>
                ))}
              </select>
            </div>

            <div className="svc-edit-field">
              <label>Target URL / PO</label>
              <textarea
                className="svc-edit-textarea"
                rows={3}
                value={targeturl}
                placeholder="Enter target URL / PO"
                onChange={e => setTargeturl(e.target.value)}
              />
            </div>

            <div className="svc-edit-field">
              <div className="svc-edit-traffic-head">
                <label>Traffic Shifter</label>
                {!noTraffic && (
                  <button type="button" className="svc-remove-traffic-btn" onClick={removeAllTraffic}>
                    Remove Traffic
                  </button>
                )}
              </div>

              <div className="svc-edit-traffic">
                {noTraffic ? (
                  <div className="svc-no-traffic">
                    <p>No traffic config</p>
                    <button type="button" className="shifter-add" onClick={addBox}>+ Add Traffic</button>
                  </div>
                ) : (
                  <>
                    {trafficRows.map((row, i) => (
                      <div key={row.key} className="shifter-row">
                        <div className="shifter-row-top">
                          <strong>{i + 1}</strong>
                          <select
                            className="cut-dropdown shifter-select"
                            value={row.id}
                            onChange={e => updateTraffic(row.key, { id: e.target.value })}
                          >
                            <option value="">Select Camp ID</option>
                            {services.map(s => (
                              <option
                                key={s.id}
                                value={String(s.id)}
                                disabled={usedIds.has(String(s.id)) && String(s.id) !== String(row.id)}
                              >
                                {s.id} — {s.servicename}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="shifter-remove"
                            title="Remove this box"
                            onClick={() => removeBox(row.key)}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="shifter-quick">
                          {PCTS.map(p => (
                            <button
                              key={p}
                              type="button"
                              className={`shifter-chip${Number(row.percent) === p ? ' active' : ''}`}
                              onClick={() => updateTraffic(row.key, { percent: p })}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="svc-traffic-actions">
                      <button type="button" className="shifter-add" onClick={addBox}>+ Add</button>
                    </div>
                    <p className={`shifter-total${total === 100 ? ' ok' : isOver ? ' over' : ' bad'}`}>
                      Total = <strong>{total}%</strong>
                      {isOver && <span> — exceeds 100%, reduce %</span>}
                      {!isOver && total < 100 && <span> — need {100 - total}% more</span>}
                    </p>
                  </>
                )}
              </div>
            </div>

            {error && <div className="shifter-error">{error}</div>}
          </div>

          <div className="modal-footer">
            <button className="cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button
              className="confirm-btn"
              onClick={requestSave}
              disabled={!canSave}
              title={!nameOk || !urlOk ? 'Name and Service URL required' : 'Add service'}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="modal-overlay confirm-overlay" onClick={e => e.target === e.currentTarget && !saving && setShowConfirm(false)}>
          <div className="modal-content confirm-save-modal">
            <div className="modal-header">
              <h2>Confirm Add</h2>
              <span className="modal-close" onClick={() => !saving && setShowConfirm(false)}>&times;</span>
            </div>
            <div className="modal-body">
              <p className="confirm-save-text">Create this D2C service?</p>
              <ul className="confirm-save-list">
                <li><span>Name</span><strong>{servicename || '—'}</strong></li>
                <li><span>DSP</span><strong>{formatPublisherDisplay(publisher) || '—'}</strong></li>
                <li><span>PG / Entity / Pack</span><strong>{[pgname, entity, pack].filter(Boolean).join(' · ') || '—'}</strong></li>
                <li><span>Service URL</span><strong>{serviceurl || '—'}</strong></li>
                <li><span>CUT</span><strong>{optimization}%</strong></li>
                <li><span>Target URL / PO</span><strong>{targeturl || '—'}</strong></li>
                <li>
                  <span>Traffic</span>
                  <strong>{noTraffic ? 'None' : buildTrafficConfigString(trafficRows)}</strong>
                </li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowConfirm(false)} disabled={saving}>Cancel</button>
              <button className="confirm-btn" onClick={confirmSave} disabled={saving}>
                {saving ? 'Adding…' : 'Yes, Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
