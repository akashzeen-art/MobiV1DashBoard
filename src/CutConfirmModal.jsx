export default function CutConfirmModal({ campaignId, oldValue, newValue, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Confirm CUT Change</h2>
          <span className="modal-close" onClick={onCancel}>&times;</span>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 16, color: '#333', fontWeight: 500, lineHeight: 1.6 }}>
            Are you sure you want to change CUT from {oldValue} to {newValue} for Campaign ID: {campaignId}?
          </p>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
