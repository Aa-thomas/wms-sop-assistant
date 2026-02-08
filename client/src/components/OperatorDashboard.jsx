import { useState } from 'react';
import PersonalBriefing from './PersonalBriefing';
import PersonalHealth from './PersonalHealth';
import PersonalTraining from './PersonalTraining';
import PersonalErrors from './PersonalErrors';
import './OperatorDashboard.css';

export default function OperatorDashboard({ onExit, onStartOnboarding, authFetch, currentUser }) {
  const [activeTab, setActiveTab] = useState('briefing');

  return (
    <div className="operator-dashboard">
      <div className="operator-dashboard-header">
        <div>
          <h1>Operator Dashboard</h1>
          <p>Personalized daily view for {currentUser?.username || 'operator'}.</p>
        </div>
        <button onClick={onExit} className="exit-btn">&times; Back to Chat</button>
      </div>

      <div className="operator-dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'briefing' ? 'active' : ''}`}
          onClick={() => setActiveTab('briefing')}
        >
          Daily Briefing
        </button>
        <button
          className={`tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          My Health
        </button>
        <button
          className={`tab-btn ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
        >
          Modules
        </button>
        <button
          className={`tab-btn ${activeTab === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          Pick Errors
        </button>
      </div>

      {activeTab === 'briefing' && <PersonalBriefing authFetch={authFetch} onNavigateTab={setActiveTab} />}
      {activeTab === 'health' && <PersonalHealth authFetch={authFetch} />}
      {activeTab === 'training' && <PersonalTraining authFetch={authFetch} onStartOnboarding={onStartOnboarding} />}
      {activeTab === 'errors' && <PersonalErrors authFetch={authFetch} />}
    </div>
  );
}
