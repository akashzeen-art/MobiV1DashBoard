import { useMemo, useState } from 'react';
import { buildTrafficConfigString } from './utils';

let rowKey = 0;
function nextKey() {
  rowKey += 1;
  return rowKey;
}

function initRows(service) {
  if (service.trafficRoutes?.length) {
    return service.trafficRoutes.map(r => ({
      key: nextKey(),
      id: String(r.id),
      percent: Number(r.percent) || 0,
    }));
  }
  return [{ key: nextKey(), id: String(service.id), percent: 100 }];
}

const PCTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export default function TrafficShifterModal({ service, allServices, onSave, onClose }) {
  const [rows, setRows] = useState(() => initRows(service));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const services = useMemo(
    () => [...allServices].sort((a, b) => a.id - b.id),
    [allServices]
  );

  const total = rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
  const usedIds = new Set(rows.map(r => String(r.id)).filter(Boolean));

  function setPercent(key, percent) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, percent } : r)));
    setError('');
  }

  function setId(key, id) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, id } : r)));
    setError('');
  }

  function addBox() {
    setRows(prev => {
      // Auto split: if only one box at 100%, make it 50/50
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
    setRows(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(r => r.key !== key);
      // If one box left, put it back to 100%
      if (next.length === 1) return [{ ...next[0], percent: 100 }];
      return next;
    });
    setError('');
  }

  async function handleSave() {
    if (rows.some(r => !r.id)) {
      setError('Please select ID for every box.');
      return;
    }
    if (new Set(rows.map(r => r.id)).size !== rows.length) {
      setError('Same ID selected twice.');
      return;
    }
    if (total !== 100) {
      setError(`Total is ${total}%. Make it 100%.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(buildTrafficConfigString(rows));
    } catch (e) {
      setError(e.message || 'Save failed.');
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal-content traffic-shifter-modal">
        <div className="modal-header">
          <h2>Traffic — #{service.id}</h2>
          <span className="modal-close" onClick={() => !saving && onClose()}>&times;</span>
        </div>

        <div className="modal-body shifter-body">
          {rows.map((row, i) => (
            <div key={row.key} className="shifter-row">
              <div className="shifter-row-top">
                <strong>#{i + 1}</strong>
                <select
                  className="cut-dropdown shifter-select"
                  value={row.id}
                  onChange={e => setId(row.key, e.target.value)}
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
                {rows.length > 1 && (
                  <button type="button" className="shifter-remove" onClick={() => removeBox(row.key)}>✕</button>
                )}
              </div>

              <div className="shifter-quick">
                {PCTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`shifter-chip${Number(row.percent) === p ? ' active' : ''}`}
                    onClick={() => setPercent(row.key, p)}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button type="button" className="shifter-add" onClick={addBox}>+ Add</button>

          <p className={`shifter-total${total === 100 ? ' ok' : ' bad'}`}>
            Total = <strong>{total}%</strong>
          </p>

          {error && <div className="shifter-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="confirm-btn" onClick={handleSave} disabled={saving || total !== 100}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
