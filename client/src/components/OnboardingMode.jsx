import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { SkeletonStep, SkeletonModuleCard } from './Skeleton';
import './OnboardingMode.css';

export default function OnboardingMode({ userId, onExit, authFetch }) {
  const [step, setStep] = useState(null);
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState(null);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [quizResult, setQuizResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState(null);
  const { showToast } = useToast();

  // Load available modules on mount
  useEffect(() => {
    authFetch('/onboarding/available')
      .then(res => res.json())
      .then(data => setModules(data))
      .catch(err => {
        console.error('Failed to load modules:', err);
        showToast('error', 'Failed to load training modules. Please refresh.');
      })
      .finally(() => setModulesLoading(false));
  }, []);

  // Start onboarding for selected module
  const startOnboarding = async (module) => {
    setLoading(true);
    try {
      const res = await authFetch('/onboarding/start', {
        method: 'POST',
        body: JSON.stringify({ module })
      });

      const data = await res.json();

      if (data.status === 'already_completed') {
        setCompletionMessage(data.message);
        setLoading(false);
        return;
      }

      setSelectedModule(module);
      setStep(data.step);
      await loadStepContent(module);

    } catch (error) {
      console.error('Failed to start onboarding:', error);
      showToast('error', 'Failed to start onboarding. Please try again.');
      setLoading(false);
    }
  };

  // Load explanation for current step
  const loadStepContent = async (module) => {
    setLoading(true);
    try {
      const res = await authFetch('/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ module })
      });

      const data = await res.json();
      setCurrentExplanation(data);
      setShowCheckpoint(false);
      setUserAnswer('');
      setQuizResult(null);

    } catch (error) {
      console.error('Failed to load step:', error);
      showToast('error', 'Failed to load step content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit answer for quiz validation
  const submitAnswer = async () => {
    setSubmitting(true);
    try {
      const res = await authFetch('/onboarding/validate-answer', {
        method: 'POST',
        body: JSON.stringify({
          module: selectedModule,
          step_number: step.step_number,
          user_answer: userAnswer
        })
      });

      const result = await res.json();
      setQuizResult(result);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      showToast('error', 'Failed to check answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Complete current step and move to next
  const completeStep = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/onboarding/complete-step', {
        method: 'POST',
        body: JSON.stringify({
          module: selectedModule,
          step_number: step.step_number
        })
      });

      const data = await res.json();

      if (data.completed) {
        setCompletionMessage(data.message);
        setLoading(false);
      } else {
        setStep(data.next_step);
        await loadStepContent(selectedModule);
      }

    } catch (error) {
      console.error('Failed to complete step:', error);
      showToast('error', 'Failed to complete step. Please try again.');
      setLoading(false);
    }
  };

  // Render completion message (replaces alert())
  if (completionMessage) {
    return (
      <div className="onboarding-step-view">
        <div className="onboarding-completion">
          <div className="completion-icon">&#10003;</div>
          <h2>Module Complete!</h2>
          <p>{completionMessage}</p>
          <button onClick={onExit} className="continue-btn">
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  // Render module selection
  if (!selectedModule) {
    return (
      <div className="onboarding-module-selector">
        <div className="onboarding-header">
          <h2>Start Onboarding</h2>
          <p>Choose a module to begin your training</p>
          <button onClick={onExit} className="exit-btn">&times; Back to Chat</button>
        </div>

        <div className="module-grid">
          {modulesLoading ? (
            <>
              <SkeletonModuleCard />
              <SkeletonModuleCard />
              <SkeletonModuleCard />
              <SkeletonModuleCard />
              <SkeletonModuleCard />
              <SkeletonModuleCard />
            </>
          ) : (
            modules.map(module => (
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
            ))
          )}
        </div>
      </div>
    );
  }

  // Render step content
  return (
    <div className="onboarding-step-view">
      {/* Progress Header */}
      <div className="onboarding-progress">
        <div className="progress-header-row">
          <div className="module-title">{selectedModule} Module</div>
          <button onClick={onExit} className="exit-btn">&times; Exit Onboarding</button>
        </div>
        <div className="progress-bar">
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
          <SkeletonStep />
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
                <strong>Quick Tip:</strong> {currentExplanation.quick_tip}
              </div>
            )}

            {/* Common Mistake */}
            {currentExplanation.common_mistake && (
              <div className="common-mistake">
                <strong>Common Mistake:</strong> {currentExplanation.common_mistake}
              </div>
            )}

            {/* Citations */}
            <div className="onboarding-citations">
              <strong>Source SOPs:</strong>
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
                I understand this step
              </button>
            ) : quizResult ? (
              <div className={`quiz-feedback ${quizResult.is_correct ? 'correct' : 'incorrect'}`}>
                <div className="feedback-icon">
                  {quizResult.is_correct ? 'Correct!' : 'Not quite'}
                </div>
                <p className="feedback-text">{quizResult.feedback}</p>

                {quizResult.can_proceed ? (
                  <>
                    {!quizResult.is_correct && (
                      <p className="retry-hint">
                        Attempts: {quizResult.attempts}/{quizResult.max_attempts}
                      </p>
                    )}
                    <button
                      onClick={completeStep}
                      className="continue-btn"
                      disabled={loading}
                    >
                      Continue to Next Step
                    </button>
                  </>
                ) : (
                  <>
                    <p className="retry-hint">
                      Attempts: {quizResult.attempts}/{quizResult.max_attempts}
                    </p>
                    <button
                      onClick={() => {
                        setQuizResult(null);
                        setUserAnswer('');
                      }}
                      className="retry-btn"
                    >
                      Try Again
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="checkpoint">
                <h3>Knowledge Check:</h3>
                <p>{step?.checkpoint_question}</p>

                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows="4"
                  className="answer-input"
                />

                <button
                  onClick={submitAnswer}
                  disabled={!userAnswer.trim() || submitting}
                  className="submit-answer-btn"
                >
                  {submitting ? 'Checking...' : 'Submit Answer'}
                </button>
              </div>
            )}
          </>
        ) : (
          <SkeletonStep />
        )}
      </div>
    </div>
  );
}

// Helper: Format explanation text (convert markdown-style to HTML)
function formatExplanation(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/(<p><\/p>)/g, '');
}
