import { useState } from 'react';

const MODULES = [
  { value: '', label: 'All Modules' },
  { value: 'Navigation', label: 'Navigation' },
  { value: 'Inbound', label: 'Inbound' },
  { value: 'Outbound', label: 'Outbound' },
  { value: 'Picking', label: 'Picking' },
  { value: 'Replenishment', label: 'Replenishment' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'CycleCounts', label: 'Cycle Counts' },
  { value: 'Returns', label: 'Returns' },
  { value: 'Admin', label: 'Admin' }
];

export default function SearchBar({ onSubmit, loading }) {
  const [question, setQuestion] = useState('');
  const [module, setModule] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    onSubmit(question.trim(), module || null);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-input-row">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question about WMS procedures..."
          disabled={loading}
          maxLength={500}
        />
        <select
          value={module}
          onChange={e => setModule(e.target.value)}
          disabled={loading}
        >
          {MODULES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? 'Searching...' : 'Ask'}
        </button>
      </div>
    </form>
  );
}
