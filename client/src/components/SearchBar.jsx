import { useState, useEffect } from 'react';

export default function SearchBar({ onSubmit, loading, authFetch }) {
  const [question, setQuestion] = useState('');
  const [module, setModule] = useState('');
  const [modules, setModules] = useState([]);

  useEffect(() => {
    if (!authFetch) return;

    // Check sessionStorage cache (1-hour TTL)
    try {
      const cached = sessionStorage.getItem('modules_available');
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 60 * 60 * 1000) {
          setModules(data);
          return;
        }
      }
    } catch { /* ignore parse errors */ }

    authFetch('/modules/available')
      .then(res => res.json())
      .then(data => {
        setModules(data);
        sessionStorage.setItem('modules_available', JSON.stringify({ data, ts: Date.now() }));
      })
      .catch(err => console.error('Failed to load modules:', err));
  }, [authFetch]);

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
          <option value="">All Modules</option>
          {modules.map(m => (
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
