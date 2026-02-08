import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useToast } from '../contexts/ToastContext';
import './PersonalErrors.css';

export default function PersonalErrors({ authFetch }) {
  const [errors, setErrors] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadErrors();
  }, []);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const [errorsRes, trendsRes] = await Promise.all([
        authFetch('/operator/errors'),
        authFetch('/operator/errors/trends'),
      ]);
      if (!errorsRes.ok || !trendsRes.ok) {
        throw new Error('Failed to load pick error data');
      }

      const [errorsData, trendsData] = await Promise.all([errorsRes.json(), trendsRes.json()]);
      setErrors(errorsData);
      setTrends(trendsData);
    } catch (error) {
      console.error('Failed to load personal errors:', error);
      showToast('error', 'Failed to load personal pick errors.');
    } finally {
      setLoading(false);
    }
  };

  const chartRows = useMemo(() => {
    if (!trends?.weeks || !trends?.data) return [];
    return trends.weeks.map((week, i) => ({ week, errors: trends.data[i] || 0 }));
  }, [trends]);

  if (loading) {
    return (
      <div className="personal-errors loading">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading pick error history...</p>
        </div>
      </div>
    );
  }

  const summary = errors?.summary || {};
  const recentErrors = errors?.recent_errors || [];
  const topItems = errors?.top_items || [];
  const hasErrors = Number(summary.total_errors || 0) > 0;

  return (
    <div className="personal-errors">
      <div className="errors-header-row">
        <h2>Pick Errors</h2>
        <button onClick={loadErrors} className="errors-refresh-btn">Refresh</button>
      </div>

      <div className="errors-summary-cards">
        <div className="errors-summary-card">
          <div className="errors-value">{summary.total_errors || 0}</div>
          <div className="errors-label">Total (90d)</div>
        </div>
        <div className="errors-summary-card">
          <div className="errors-value">{summary.errors_7d || 0}</div>
          <div className="errors-label">Last 7 Days</div>
        </div>
        <div className="errors-summary-card">
          <div className="errors-value">{summary.errors_30d || 0}</div>
          <div className="errors-label">Last 30 Days</div>
        </div>
        <div className="errors-summary-card">
          <div className="errors-value">{summary.avg_variance || 0}</div>
          <div className="errors-label">Avg Variance</div>
        </div>
      </div>

      {chartRows.length > 0 && (
        <div className="errors-chart-card">
          <h3>Weekly Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartRows} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="errors"
                stroke="var(--accent-primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {topItems.length > 0 && (
        <div className="errors-top-items">
          <strong>Most frequent items:</strong>
          {topItems.map(item => (
            <span key={item.item} className="errors-item-tag">
              {item.item} ({item.count})
            </span>
          ))}
        </div>
      )}

      {!hasErrors ? (
        <div className="errors-empty-state">
          <p>No pick errors in the last 90 days. Keep it up.</p>
        </div>
      ) : (
        <div className="errors-table-wrapper">
          <table className="errors-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>PPS</th>
                <th>Shipment</th>
                <th>Item</th>
                <th>Variance</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {recentErrors.map(row => (
                <tr key={row.id}>
                  <td>{formatDate(row.created_at)}</td>
                  <td>{row.pps_number}</td>
                  <td>{row.shipment_number}</td>
                  <td>{row.item}</td>
                  <td className={Number(row.quantity_variance) < 0 ? 'neg' : 'pos'}>{row.quantity_variance}</td>
                  <td>{row.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
