import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { SkeletonStep, SkeletonModuleCard } from './Skeleton';
import PageTooltips from './PageTooltips';
import { ONBOARDING_TOOLTIPS } from '../lib/tourConfig';
import './OnboardingMode.css';

export default function OnboardingMode({ userId, onExit, authFetch, initialModule, tourActive, onTourEnd, onPageComplete }) {
  const [step, setStep] = useState(null);
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stepData, setStepData] = useState(null);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [missingImages, setMissingImages] = useState({});
  const { showToast } = useToast();

  function toggle(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function getChunkPreview(text) {
    if (!text) return '';
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length <= 1) return lines[0] || '';
    return lines.slice(1).join(' ').trim();
  }

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

  // Auto-start module if initialModule is provided
  useEffect(() => {
    if (initialModule && !modulesLoading && modules.length > 0 && !selectedModule) {
      startOnboarding(initialModule);
    }
  }, [initialModule, modulesLoading, modules]);

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
      setStepData(data);
      setShowCheckpoint(false);
      setSelectedOption(null);
      setQuizResult(null);
      setExpanded({});
      setMissingImages({});

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
          step_number: stepData?.step_number || step.step_number,
          selected_option: selectedOption
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
          step_number: stepData?.step_number || step.step_number
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

        {tourActive && (
          <PageTooltips tooltips={ONBOARDING_TOOLTIPS} onSkipTour={onTourEnd} onPageComplete={onPageComplete} />
        )}
      </div>
    );
  }

  const totalSteps = stepData?.total_steps || step?.total_steps || 0;
  const completedCount = stepData?.completed_count ?? step?.completed_count ?? 0;
  const currentStep = stepData?.step_number || step?.step_number || 1;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  // Helper to get option class based on quiz result state
  const getOptionClass = (index) => {
    if (!quizResult) {
      return index === selectedOption ? 'selected' : '';
    }
    const classes = ['locked'];
    if (index === quizResult.correct_option_index) {
      classes.push('correct-answer');
    }
    if (index === selectedOption && !quizResult.is_correct) {
      classes.push('wrong-answer');
    }
    return classes.join(' ');
  };

  // Helper to get radio icon based on state
  const getRadioIcon = (index) => {
    if (!quizResult) {
      return index === selectedOption ? <span className="radio-filled" /> : null;
    }
    if (index === quizResult.correct_option_index) {
      return <span className="radio-check">&#10003;</span>;
    }
    if (index === selectedOption && !quizResult.is_correct) {
      return <span className="radio-x">&#10005;</span>;
    }
    return null;
  };

  // Render step content
  return (
    <div className="onboarding-step-view">
      {/* Progress Header */}
      <div className="onboarding-progress">
        <div className="progress-header-row">
          <div className="module-title">
            {selectedModule} Module
            <span className="progress-percentage">{progressPct}%</span>
          </div>
          <button onClick={onExit} className="exit-btn">&times; Exit Onboarding</button>
        </div>

        {/* Progress Dots */}
        <div className="progress-dots">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum <= completedCount;
            const isCurrent = stepNum === currentStep;
            return (
              <div
                key={stepNum}
                className={`progress-dot${isCompleted ? ' completed' : ''}${isCurrent ? ' current' : ''}`}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="dot-number">{stepNum}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="step-indicator-text">
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      {/* Step Content — key forces remount on step change for animation */}
      <div className="step-content" key={`step-${stepData?.step_number}`}>
        {loading ? (
          <SkeletonStep />
        ) : stepData?.chunks ? (
          <>
            <h2>{stepData.step_title}</h2>
            <p className="step-description">{stepData.step_description}</p>

            {/* SOP Slides as Step Boxes */}
            <ol className="step-list">
              {stepData.chunks.map((chunk, i) => {
                const isExpanded = !!expanded[`chunk-${i}`];
                return (
                  <li
                    key={chunk.id}
                    className={`step-item has-slide ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => toggle(`chunk-${i}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle(`chunk-${i}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="step-head">
                      <div className="step-index">{i + 1}</div>
                      <div className="step-body">
                        <div className="step-claim">{getChunkPreview(chunk.text)}</div>
                        <div className="inline-citations">
                          <span className="citation-text">{chunk.source_locator}</span>
                        </div>
                      </div>
                      <div className="step-chevron" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="step-slide-panel">
                        <div className="slide-content">
                          {chunk.image_url && !missingImages[chunk.image_url] && (
                            <img
                              src={chunk.image_url}
                              alt={chunk.source_locator}
                              className="slide-image"
                              onError={() => setMissingImages(prev => ({ ...prev, [chunk.image_url]: true }))}
                            />
                          )}
                          <pre>{chunk.text}</pre>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Checkpoint */}
            {!showCheckpoint ? (
              <button
                onClick={() => setShowCheckpoint(true)}
                className="checkpoint-btn"
              >
                I've reviewed these slides
              </button>
            ) : (
              <div className="checkpoint">
                <h3>Knowledge Check:</h3>
                <p>{stepData.checkpoint}</p>

                {/* MC Options */}
                <div className="mc-options">
                  {(stepData.checkpoint_options || []).map((option, i) => (
                    <button
                      key={i}
                      className={`mc-option ${getOptionClass(i)}`}
                      onClick={() => { if (!quizResult) setSelectedOption(i); }}
                      disabled={!!quizResult}
                    >
                      <div className="mc-radio">
                        {getRadioIcon(i)}
                      </div>
                      <div className="mc-option-text">{option}</div>
                    </button>
                  ))}
                </div>

                {/* Submit / Feedback */}
                {!quizResult ? (
                  <button
                    onClick={submitAnswer}
                    disabled={selectedOption === null || submitting}
                    className="submit-answer-btn"
                  >
                    {submitting ? 'Checking...' : 'Submit Answer'}
                  </button>
                ) : (
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
                            setSelectedOption(null);
                          }}
                          className="retry-btn"
                        >
                          Try Again
                        </button>
                      </>
                    )}
                  </div>
                )}
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
