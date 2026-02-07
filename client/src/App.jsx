import { useState } from 'react';
import SearchBar from './components/SearchBar';
import Answer from './components/Answer';
import './App.css';

function App() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuestion, setLastQuestion] = useState('');

  async function handleSubmit(question, module) {
    setLoading(true);
    setError(null);
    setResponse(null);
    setLastQuestion(question);

    try {
      const body = { question };
      if (module) body.module = module;

      const res = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(question, helpful) {
    try {
      await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          response_id: `${Date.now()}`,
          helpful
        })
      });
    } catch {
      // Silently fail — feedback is non-critical
    }
  }

  return (
    <div className="app">
      <header>
        <h1>WMS SOP Assistant</h1>
        <p className="subtitle">Search warehouse procedures — answers from SOPs only</p>
      </header>

      <main>
        <SearchBar onSubmit={handleSubmit} loading={loading} />

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <span>Searching SOPs...</span>
          </div>
        )}

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        <Answer
          data={response}
          question={lastQuestion}
          onFeedback={handleFeedback}
        />
      </main>
    </div>
  );
}

export default App;
