import { useState, useEffect, useMemo } from 'react';
import {
  fetchServices,
  saveService,
  formatPublisherDisplay,
} from './utils';
import ServiceEditModal from './ServiceEditModal';
import ServiceAddModal from './ServiceAddModal';

function TrafficBars({ routes, nameById }) {
  if (!routes.length) return <span className="muted traffic-empty">No split</span>;
  const COLORS = ['#5b6cfa', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="traffic-routes">
      <div className="traffic-mini-bar">
        {routes.map((r, i) => (
          <div
            key={r.id}
            className="traffic-mini-seg"
            style={{ flexGrow: r.percent, background: COLORS[i % COLORS.length] }}
            title={`#${r.id} ${r.percent}%`}
          />
        ))}
      </div>
      <div className="traffic-mini-list">
        {routes.map((r, i) => (
          <div key={r.id} className="traffic-mini-item">
            <i style={{ background: COLORS[i % COLORS.length] }} />
            <span className="traffic-chip-id">#{r.id}</span>
            <span className="traffic-chip-name">{nameById.get(Number(r.id)) || ''}</span>
            <strong>{r.percent}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ServicesPage({ onLogout, onNavigate }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('all');
  const [editService, setEditService] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setServices(await fetchServices());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const nameById = useMemo(() => {
    const map = new Map();
    services.forEach(s => map.set(s.id, s.servicename));
    return map;
  }, [services]);

  const publishers = useMemo(
    () => [...new Set(services.map(s => s.publisher).filter(p => p && p !== '-'))].sort(),
    [services]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter(s => {
      if (publisherFilter !== 'all' && s.publisher !== publisherFilter) return false;
      if (!q) return true;
      return (
        String(s.id).includes(q) ||
        s.servicename.toLowerCase().includes(q) ||
        (s.pgname || '').toLowerCase().includes(q) ||
        (s.entity || '').toLowerCase().includes(q) ||
        (s.pack || '').toLowerCase().includes(q) ||
        s.publisher.toLowerCase().includes(q) ||
        formatPublisherDisplay(s.publisher).toLowerCase().includes(q) ||
        s.serviceurl.toLowerCase().includes(q) ||
        s.targeturl.toLowerCase().includes(q)
      );
    });
  }, [services, search, publisherFilter]);

  async function handleSave(payload) {
    await saveService(payload);
    setEditService(null);
    setStatusMsg(`Service #${payload.id} saved.`);
    await load();
  }

  async function handleAdd(payload) {
    await saveService(payload);
    setShowAdd(false);
    setStatusMsg(`Service “${payload.servicename}” added.`);
    await load();
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>📊 V1 Mobi Dashboard</h1>
          <nav className="app-nav">
            <button className="nav-btn" onClick={() => onNavigate('reports')}>Reports</button>
            <button className="nav-btn active">Services</button>
          </nav>
        </div>
        <button className="logout-button" onClick={onLogout}>Logout</button>
      </header>

      <section className="filters-section">
        <div className="services-toolbar">
          <div className="date-input-group" style={{ flex: 1, minWidth: 200 }}>
            <label>Search</label>
            <input
              className="date-input"
              style={{ width: '100%' }}
              placeholder="ID, name, PG, entity, pack, publisher, URL…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="date-input-group">
            <label>Publisher</label>
            <select className="cut-dropdown" value={publisherFilter} onChange={e => setPublisherFilter(e.target.value)}>
              <option value="all">All</option>
              {publishers.map(p => <option key={p} value={p}>{formatPublisherDisplay(p)}</option>)}
            </select>
          </div>
          <button className="view-button" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="svc-add-btn" onClick={() => { setStatusMsg(''); setShowAdd(true); }}>
            + Add Service
          </button>
        </div>
        <p className="services-count">
          Showing <strong>{filtered.length}</strong> of <strong>{services.length}</strong> services
        </p>
        {statusMsg && <div className="svc-status-msg ok">{statusMsg}</div>}
      </section>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner" />
          <p>Loading services…</p>
        </div>
      )}

      {!loading && error && <div className="error-banner">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">No services match your filters.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="services-table-wrap">
          <table className="services-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Service Name</th>
                <th>PG Name</th>
                <th>Entity</th>
                <th>Pack</th>
                <th>Publisher</th>
                <th>Type</th>
                <th>CUT</th>
                <th>Service URL</th>
                <th>Target URL / PO</th>
                <th>Traffic Config</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="svc-id">{s.id}</td>
                  <td className="svc-name">{s.servicename}</td>
                  <td>{s.pgname || '—'}</td>
                  <td>{s.entity || '—'}</td>
                  <td>{s.pack || '—'}</td>
                  <td>{s.publisher && s.publisher !== '-' ? formatPublisherDisplay(s.publisher) : '—'}</td>
                  <td>
                    <span className={`type-badge type-${s.type}`}>{s.type}</span>
                  </td>
                  <td><span className="svc-readonly">{s.optimization}</span></td>
                  <td className="svc-url">
                    {s.serviceurl
                      ? <a href={s.serviceurl} target="_blank" rel="noreferrer" className="clickable-link">{s.serviceurl}</a>
                      : '—'}
                  </td>
                  <td className="svc-url">
                    {s.targeturl
                      ? <a href={s.targeturl.startsWith('http') ? s.targeturl : undefined}
                          target="_blank" rel="noreferrer" className="clickable-link">{s.targeturl}</a>
                      : '—'}
                  </td>
                  <td>
                    <TrafficBars routes={s.trafficRoutes} nameById={nameById} />
                  </td>
                  <td className="traffic-action-cell">
                    <button
                      type="button"
                      className="traffic-edit-btn"
                      onClick={() => { setStatusMsg(''); setEditService(s); }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editService && (
        <ServiceEditModal
          service={editService}
          allServices={services}
          onSave={handleSave}
          onClose={() => setEditService(null)}
        />
      )}

      {showAdd && (
        <ServiceAddModal
          allServices={services}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
