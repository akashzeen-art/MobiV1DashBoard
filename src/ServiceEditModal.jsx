import { useMemo, useState } from 'react';
import {
  formatPublisherDisplay,
  parseTrafficConfig,
  buildTrafficConfigString,
} from './utils';

const CUT_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const PCTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

let rowKey = 0;
function nextKey() {
  rowKey += 1;
  return rowKey;
}

function toTrafficRows(service) {
  if (service.trafficRoutes?.length) {
    return service.trafficRoutes.map(r => ({
      key: nextKey(),
      id: String(r.id),
      percent: Number(r.percent) || 0,
    }));
  }
  return [{ key: nextKey(), id: String(service.id), percent: 100 }];
}

export default function ServiceEditModal({ service, allServices, onSave, onClose }) {
  const [optimization, setOptimization] = useState(Number(service.optimization ?? 0));
  const [targeturl, setTargeturl] = useState(service.targeturl || '');
  const [trafficRows, setTrafficRows] = useState(() => toTrafficRows(service));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const services = useMemo(
    () => [...allServices].sort((a, b) => a.id - b.id),
    [allServices]
  );

  const total = trafficRows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
  const usedIds = new Set(trafficRows.map(r => String(r.id)).filter(Boolean));
  const publisherLabel = formatPublisherDisplay(service.publisher);
  const noTraffic = trafficRows.length === 0;
  const isOver = !noTraffic && total > 100;
  const trafficOk = noTraffic || total === 100;
  const canSave = !saving && trafficOk && !isOver;

  function updateTraffic(key, patch) {
    setTrafficRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setError('');
  }

  function addBox() {
    setTrafficRows(prev => {
      if (prev.length === 0) {
        return [{ key: nextKey(), id: String(service.id), percent: 100 }];
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
      ...service,
      optimization: Number(optimization),
      targeturl: targeturl || '',
      traffic_config,
      trafficRoutes: parseTrafficConfig(traffic_config),
    };
  }

  function requestSave() {
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
      setError(e.message || 'Save failed.');
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
        <div className="modal-content service-edit-modal" role="dialog" aria-labelledby="svc-edit-title">
          <div className="modal-header">
            <h2 id="svc-edit-title">Edit Service #{service.id}</h2>
            <span className="modal-close" onClick={() => !saving && onClose()}>&times;</span>
          </div>

          <div className="modal-body service-edit-body">
            <div className="svc-edit-info">
              <div><span>Name</span><strong>{service.servicename}</strong></div>
              <div><span>Publisher</span><strong>{publisherLabel || '—'}</strong></div>
              <div><span>Type</span><strong>{service.type}</strong></div>
              <div className="full">
                <span>Service URL</span>
                <strong className="svc-edit-url">{service.serviceurl || '—'}</strong>
              </div>
            </div>

            <div className="svc-edit-field">
              <label>CUT</label>
              <select
                className="cut-dropdown"
                value={String(optimization)}
                onChange={e => { setOptimization(Number(e.target.value)); setError(''); }}
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
                onChange={e => { setTargeturl(e.target.value); setError(''); }}
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
              title={isOver ? 'Traffic exceeds 100%' : !trafficOk ? 'Traffic must be exactly 100%' : 'Save'}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="modal-overlay confirm-overlay" onClick={e => e.target === e.currentTarget && !saving && setShowConfirm(false)}>
          <div className="modal-content confirm-save-modal">
            <div className="modal-header">
              <h2>Confirm Save</h2>
              <span className="modal-close" onClick={() => !saving && setShowConfirm(false)}>&times;</span>
            </div>
            <div className="modal-body">
              <p className="confirm-save-text">
                Save changes for Service <strong>#{service.id}</strong>?
              </p>
              <ul className="confirm-save-list">
                <li><span>CUT</span><strong>{optimization}%</strong></li>
                <li><span>Target URL / PO</span><strong>{targeturl || '—'}</strong></li>
                <li>
                  <span>Traffic</span>
                  <strong>{noTraffic ? 'Removed' : buildTrafficConfigString(trafficRows)}</strong>
                </li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowConfirm(false)} disabled={saving}>Cancel</button>
              <button className="confirm-btn" onClick={confirmSave} disabled={saving}>
                {saving ? 'Saving…' : 'Yes, Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
