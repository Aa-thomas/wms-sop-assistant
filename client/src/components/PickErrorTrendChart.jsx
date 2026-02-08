import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid
} from 'recharts';

const COLORS = [
  'var(--accent-primary)',
  '#e8594f',
  '#f0a03c',
  '#4caf7d',
  '#9c6ade',
  '#e67db5',
  '#3dc4c4',
];

export default function PickErrorTrendChart({ trendData }) {
  if (!trendData || !trendData.weeks || trendData.weeks.length === 0) {
    return (
      <div className="trend-chart-section">
        <h3>Errors Over Time</h3>
        <div className="trend-chart-empty">No trend data available yet.</div>
      </div>
    );
  }

  const { weeks, series, usernames } = trendData;
  const userIds = Object.keys(series);

  // Transform into Recharts row format: [{ week: '...', userId1: count, userId2: count }, ...]
  const rows = weeks.map((week, i) => {
    const row = { week };
    for (const uid of userIds) {
      row[uid] = series[uid][i];
    }
    return row;
  });

  const showLegend = userIds.length > 1;

  return (
    <div className="trend-chart-section">
      <h3>Errors Over Time</h3>
      <div className="trend-chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={rows} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-default)' }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-default)' }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
              }}
              labelFormatter={(label) => `Week of ${label}`}
              formatter={(value, name) => [value, usernames[name] || name]}
            />
            {showLegend && (
              <Legend
                formatter={(value) => usernames[value] || value}
                wrapperStyle={{ fontSize: '0.8rem' }}
              />
            )}
            {userIds.map((uid, i) => (
              <Line
                key={uid}
                type="monotone"
                dataKey={uid}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
