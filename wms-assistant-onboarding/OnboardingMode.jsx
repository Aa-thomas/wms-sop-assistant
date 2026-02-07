// client/src/components/OnboardingMode.jsx

import React, { useState, useEffect } from 'react';

/**
 * Onboarding Mode Component
 * Integrates into existing chat interface
 */
export default function OnboardingMode({ userId, onExit }) {
  const [step, setStep] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState(null);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  
  // Load available modules on mount
  useEffect(() => {
    fetch('/onboarding/available')
      .then(res => res.json())
      .then(data => setModules(data))
      .catch(err => console.error('Failed to load modules:', err));
  }, []);
  
  // Start onboarding for selected module
  const startOnboarding = async (module) => {
    setLoading(true);
    try {
      const res = await fetch('/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, module })
      });
      
      const data = await res.json();
      
      if (data.status === 'already_completed') {
        alert(data.message);
        return;
      }
      
      setSelectedModule(module);
      setStep(data.step);
      loadStepContent(module);
      
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      alert('Failed to start onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Load explanation for current step
  const loadStepContent = async (module) => {
    setLoading(true);
    try {
      const res = await fetch('/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, module })
      });
      
      const data = await res.json();
      setCurrentExplanation(data);
      setShowCheckpoint(false);
      
    } catch (error) {
      console.error('Failed to load step:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Complete current step and move to next
  const completeStep = async () => {
    setLoading(true);
    try {
      const res = await fetch('/onboarding/complete-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId, 
          module: selectedModule,
          step_number: step.step_number
        })
      });
      
      const data = await res.json();
      
      if (data.completed) {
        // Show completion message
        alert(data.message);
        onExit(); // Return to normal chat mode
      } else {
        // Move to next step
        setStep(data.next_step);
        loadStepContent(selectedModule);
      }
      
    } catch (error) {
      console.error('Failed to complete step:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Render module selection
  if (!selectedModule) {
    return (
      <div className="onboarding-module-selector">
        <div className="onboarding-header">
          <h2>🎯 Start Onboarding</h2>
          <p>Choose a module to begin your training</p>
          <button onClick={onExit} className="exit-btn">× Back to Chat</button>
        </div>
        
        <div className="module-grid">
          {modules.map(module => (
            <div key={module.module} className="module-card">
              <h3>{module.module}</h3>
              <p className="step-count">{module.total_steps} steps</p>
              <p className="topics">{module.topics}</p>
              <button 
                onClick={() => startOnboarding(module.module)}
                disabled={loading}
                className="start-btn"
              >
                Start Learning
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Render step content
  return (
    <div className="onboarding-step-view">
      {/* Progress Header */}
      <div className="onboarding-progress">
        <button onClick={onExit} className="exit-btn">× Exit Onboarding</button>
        <div className="progress-bar">
          <div className="module-title">{selectedModule} Module</div>
          <div className="step-indicator">
            Step {step?.step_number} of {step?.total_steps}
          </div>
          <div className="progress-fill" style={{
            width: `${(step?.completed_count / step?.total_steps) * 100}%`
          }} />
        </div>
      </div>
      
      {/* Step Content */}
      <div className="step-content">
        {loading ? (
          <div className="loading">Loading step content...</div>
        ) : currentExplanation ? (
          <>
            <h2>{step?.step_title}</h2>
            <p className="step-description">{step?.step_description}</p>
            
            {/* Explanation */}
            <div className="explanation">
              <div dangerouslySetInnerHTML={{ 
                __html: formatExplanation(currentExplanation.explanation) 
              }} />
            </div>
            
            {/* Quick Tip */}
            {currentExplanation.quick_tip && (
              <div className="quick-tip">
                <strong>💡 Quick Tip:</strong> {currentExplanation.quick_tip}
              </div>
            )}
            
            {/* Common Mistake */}
            {currentExplanation.common_mistake && (
              <div className="common-mistake">
                <strong>⚠️ Common Mistake:</strong> {currentExplanation.common_mistake}
              </div>
            )}
            
            {/* Citations */}
            <div className="citations">
              <strong>📚 Source SOPs:</strong>
              <ul>
                {currentExplanation.citations?.map((cite, idx) => (
                  <li key={idx}>
                    {cite.doc_title} - {cite.source_locator}
                    {cite.relevance && <span className="relevance"> - {cite.relevance}</span>}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Checkpoint */}
            {!showCheckpoint ? (
              <button 
                onClick={() => setShowCheckpoint(true)}
                className="checkpoint-btn"
              >
                ✓ I understand this step
              </button>
            ) : (
              <div className="checkpoint">
                <h3>Knowledge Check:</h3>
                <p>{step?.checkpoint_question}</p>
                <p className="checkpoint-help">
                  Think about your answer, then click Continue when you're ready.
                </p>
                <button 
                  onClick={completeStep}
                  className="continue-btn"
                  disabled={loading}
                >
                  Continue to Next Step →
                </button>
              </div>
            )}
          </>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    </div>
  );
}

// Helper: Format explanation text (convert markdown-style to HTML)
function formatExplanation(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\n\n/g, '</p><p>') // Paragraphs
    .replace(/^(.+)$/gm, '<p>$1</p>') // Wrap lines
    .replace(/(<p><\/p>)/g, ''); // Remove empty paragraphs
}
