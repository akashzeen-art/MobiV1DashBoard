import { useState } from 'react';
import { formatDateDisplay } from './utils';

export default function DateExportModal({ dates, onConfirm, onClose }) {
  const [selected, setSelected] = useState(new Set(dates));

  function toggle(date) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Select Dates to Export</h2>
          <span className="modal-close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          <div className="date-selection-controls">
            <button className="select-btn" onClick={() => setSelected(new Set(dates))}>Select All</button>
            <button className="select-btn" onClick={() => setSelected(new Set())}>Deselect All</button>
          </div>
          <div className="date-checkboxes">
            {dates.map(date => (
              <div key={date} className="date-checkbox-item">
                <input type="checkbox" id={`d_${date}`} checked={selected.has(date)} onChange={() => toggle(date)} />
                <label htmlFor={`d_${date}`}>{formatDateDisplay(date)}</label>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="confirm-btn" onClick={() => {
            if (selected.size === 0) { alert('Please select at least one date.'); return; }
            onConfirm([...selected]);
          }}>Export Selected Dates</button>
        </div>
      </div>
    </div>
  );
}
