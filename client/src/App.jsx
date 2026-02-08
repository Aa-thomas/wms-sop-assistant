import { useState } from 'react';
import SearchBar from './components/SearchBar';
import Answer from './components/Answer';
import OnboardingMode from './components/OnboardingMode';
import SupervisorDashboard from './components/SupervisorDashboard';
import { SkeletonAnswer } from './components/Skeleton';
import { useToast } from './contexts/ToastContext';
import './App.css';

function App() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [mode, setMode] = useState('chat');
  const { showToast } = useToast();
  const [userId] = useState(() => {
    let id = localStorage.getItem('user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('user_id', id);
    }
    return id;
  });

  async function handleSubmit(question, module) {
    setLoading(true);
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
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(interactionId, helpful, comment) {
    try {
      await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_id: interactionId,
          helpful,
          comment: comment || null
        })
      });
    } catch {
      // Silently fail — feedback is non-critical
    }
  }

  if (mode === 'onboarding') {
    return (
      <div className="app">
        <OnboardingMode userId={userId} onExit={() => setMode('chat')} />
      </div>
    );
  }

  if (mode === 'supervisor') {
    return (
      <div className="app" style={{ maxWidth: '1400px' }}>
        <SupervisorDashboard onExit={() => setMode('chat')} />
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>WMS SOP Assistant</h1>
        <p className="subtitle">Search warehouse procedures — answers from SOPs only</p>
        <div className="header-buttons">
          <button
            className="onboarding-trigger-btn"
            onClick={() => setMode('onboarding')}
          >
            Start Onboarding
          </button>
          <button
            className="supervisor-trigger-btn"
            onClick={() => setMode('supervisor')}
          >
            Supervisor Dashboard
          </button>
        </div>
      </header>

      <main>
        <SearchBar onSubmit={handleSubmit} loading={loading} />

        {loading && <SkeletonAnswer />}

        <Answer
          data={response}
          interactionId={response?.interaction_id}
          onFeedback={handleFeedback}
        />
      </main>
    </div>
  );
}

export default App;
