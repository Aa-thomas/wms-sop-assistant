import { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import Answer from './components/Answer';
import OnboardingMode from './components/OnboardingMode';
import SupervisorDashboard from './components/SupervisorDashboard';
import OperatorDashboard from './components/OperatorDashboard';
import LoginForm from './components/LoginForm';
import AnonymousFeedbackForm from './components/AnonymousFeedbackForm';
import { SkeletonAnswer } from './components/Skeleton';
import { useToast } from './contexts/ToastContext';
import './App.css';

const STARTER_PROMPTS = [
  { icon: '📦', title: 'Inbound Orders', question: 'How do I process an inbound order?', module: 'Inbound' },
  { icon: '🔄', title: 'Cycle Counting', question: 'What are the steps for cycle counting?', module: 'CycleCounts' },
  { icon: '↩️', title: 'Returns', question: 'How do I handle customer returns?', module: 'Returns' },
  { icon: '🎯', title: 'Pick Process', question: "What's the pick process at a PPS station?", module: 'Picking' },
];

function authFetch(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });
}

function App() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [mode, setMode] = useState('chat');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const { showToast } = useToast();

  // Validate existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setAuthLoading(false);
      return;
    }

    authFetch('/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then(user => setCurrentUser(user))
      .catch(() => {
        localStorage.removeItem('auth_token');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  function handleLogin(user) {
    setCurrentUser(user);
  }

  function handleLogout() {
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
    setMode('chat');
    setResponse(null);
  }

  // Wrapper that handles 401 responses globally
  async function authedFetch(url, options = {}) {
    const res = await authFetch(url, options);
    if (res.status === 401) {
      handleLogout();
      showToast('error', 'Session expired. Please sign in again.');
      throw new Error('Session expired');
    }
    return res;
  }

  async function handleSubmit(question, module) {
    setLoading(true);
    setResponse(null);
    setLastQuestion(question);

    try {
      const body = { question };
      if (module) body.module = module;

      const res = await authedFetch('/ask', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      if (err.message !== 'Session expired') {
        showToast('error', err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(interactionId, helpful, comment) {
    try {
      await authedFetch('/feedback', {
        method: 'POST',
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

  // Show nothing while checking auth
  if (authLoading) {
    return null;
  }

  // Auth gate
  if (!currentUser) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (mode === 'onboarding') {
    return (
      <div className="app">
        <OnboardingMode
          userId={currentUser.id.toString()}
          onExit={() => setMode('chat')}
          authFetch={authedFetch}
        />
      </div>
    );
  }

  if (mode === 'supervisor') {
    return (
      <div className="app" style={{ maxWidth: '1400px' }}>
        <SupervisorDashboard onExit={() => setMode('chat')} authFetch={authedFetch} currentUserId={currentUser.id} />
      </div>
    );
  }

  if (mode === 'operator') {
    return (
      <div className="app" style={{ maxWidth: '1400px' }}>
        <OperatorDashboard
          onExit={() => setMode('chat')}
          onStartOnboarding={() => setMode('onboarding')}
          authFetch={authedFetch}
          currentUser={currentUser}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="header-top-row">
          <span className="user-info">Signed in as <strong>{currentUser.username}</strong></span>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
        <h1>WMS SOP Assistant</h1>
        <p className="subtitle">Search warehouse procedures — answers from SOPs only</p>
        <div className="header-buttons">
          <button
            className="operator-trigger-btn"
            onClick={() => setMode('operator')}
          >
            Operator Dashboard
          </button>
          <button
            className="onboarding-trigger-btn"
            onClick={() => setMode('onboarding')}
          >
            Start Onboarding
          </button>
          {currentUser.is_supervisor && (
            <button
              className="supervisor-trigger-btn"
              onClick={() => setMode('supervisor')}
            >
              Supervisor Dashboard
            </button>
          )}
        </div>
      </header>

      <main>
        <SearchBar onSubmit={handleSubmit} loading={loading} authFetch={authedFetch} />

        {!response && !loading && (
          <div className="starter-prompts">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt.title}
                className="starter-card"
                onClick={() => handleSubmit(prompt.question, prompt.module)}
              >
                <span className="starter-icon">{prompt.icon}</span>
                <span className="starter-title">{prompt.title}</span>
                <span className="starter-question">{prompt.question}</span>
              </button>
            ))}
          </div>
        )}

        {loading && <SkeletonAnswer />}

        <Answer
          data={response}
          interactionId={response?.interaction_id}
          onFeedback={handleFeedback}
        />
      </main>

      {/* Anonymous Feedback FAB */}
      <button
        className="feedback-fab"
        onClick={() => setShowFeedbackForm(true)}
        title="Submit anonymous feedback"
      >
        💬
      </button>

      <AnonymousFeedbackForm
        authFetch={authedFetch}
        isOpen={showFeedbackForm}
        onClose={() => setShowFeedbackForm(false)}
      />
    </div>
  );
}

export default App;
