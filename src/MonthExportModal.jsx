import { useState } from 'react';
import { formatMonthDisplay } from './utils';

export default function MonthExportModal({ months, onConfirm, onClose }) {
  const [selected, setSelected] = useState(new Set());

  function toggle(month) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Select Months to Export</h2>
          <span className="modal-close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          <div className="date-selection-controls">
            <button className="select-btn" onClick={() => setSelected(new Set(months))}>Select All</button>
            <button className="select-btn" onClick={() => setSelected(new Set())}>Deselect All</button>
          </div>
          <div className="date-checkboxes">
            {months.map(month => (
              <div key={month} className="date-checkbox-item">
                <input type="checkbox" id={`m_${month}`} checked={selected.has(month)} onChange={() => toggle(month)} />
                <label htmlFor={`m_${month}`}>{formatMonthDisplay(month)}</label>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="confirm-btn" onClick={() => {
            if (selected.size === 0) { alert('Please select at least one month.'); return; }
            onConfirm([...selected].sort());
          }}>Export Selected Months</button>
        </div>
      </div>
    </div>
  );
}
