import { useState, useEffect, useCallback } from 'react';
import './WelcomeTour.css';

const STEPS = [
  {
    icon: 'search',
    headline: 'Welcome to WMS SOP Assistant',
    description: 'Search warehouse procedures, get instant answers grounded in your SOPs — with source citations you can trust.',
  },
  {
    icon: 'question',
    headline: 'Ask Anything About Your SOPs',
    description: 'Type a question, pick a module filter, and get step-by-step answers with source citations. Try "How do I process an inbound order?"',
  },
  {
    icon: 'dashboard',
    headline: 'Track Your Progress',
    description: 'Click Operator Dashboard to see your personalized daily summary — health metrics, pick error trends, and daily briefings.',
  },
  {
    icon: 'training',
    headline: 'Learn at Your Own Pace',
    description: 'Click Start Onboarding to begin structured training on warehouse procedures. Work through step-by-step modules with quizzes.',
  },
  {
    icon: 'rocket',
    headline: "You're All Set!",
    description: "You're ready to go. Search SOPs, check your dashboard, or jump into training — it's all here when you need it.",
  },
];

function StepIllustration({ icon }) {
  if (icon === 'search') {
    return (
      <div className="tour-illustration">
        <div className="tour-icon-search">
          <div className="tour-icon-lens" />
          <div className="tour-icon-handle" />
        </div>
        <div className="tour-icon-lines">
          <div className="tour-icon-line tour-icon-line--1" />
          <div className="tour-icon-line tour-icon-line--2" />
          <div className="tour-icon-line tour-icon-line--3" />
        </div>
      </div>
    );
  }
  if (icon === 'question') {
    return (
      <div className="tour-illustration">
        <div className="tour-icon-chat">
          <div className="tour-icon-bubble">
            <span>?</span>
          </div>
          <div className="tour-icon-bubble tour-icon-bubble--reply">
            <div className="tour-icon-line tour-icon-line--short" />
            <div className="tour-icon-line tour-icon-line--med" />
          </div>
        </div>
      </div>
    );
  }
  if (icon === 'dashboard') {
    return (
      <div className="tour-illustration">
        <div className="tour-icon-grid">
          <div className="tour-icon-card tour-icon-card--1" />
          <div className="tour-icon-card tour-icon-card--2" />
          <div className="tour-icon-card tour-icon-card--3" />
          <div className="tour-icon-card tour-icon-card--4" />
        </div>
      </div>
    );
  }
  if (icon === 'training') {
    return (
      <div className="tour-illustration">
        <div className="tour-icon-steps">
          <div className="tour-icon-step tour-icon-step--done">
            <div className="tour-icon-check" />
          </div>
          <div className="tour-icon-step tour-icon-step--active" />
          <div className="tour-icon-step" />
        </div>
      </div>
    );
  }
  // rocket
  return (
    <div className="tour-illustration">
      <div className="tour-icon-rocket">
        <div className="tour-icon-rocket-body" />
        <div className="tour-icon-rocket-window" />
        <div className="tour-icon-rocket-flame" />
      </div>
    </div>
  );
}

export default function WelcomeTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState('next');
  const [animating, setAnimating] = useState(false);
  const isLastStep = currentStep === STEPS.length - 1;

  const completeTour = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (animating) return;
    if (isLastStep) {
      completeTour();
      return;
    }
    setDirection('next');
    setAnimating(true);
    setTimeout(() => {
      setCurrentStep(s => s + 1);
      setAnimating(false);
    }, 200);
  }, [animating, isLastStep, completeTour]);

  const goPrev = useCallback(() => {
    if (animating || currentStep === 0) return;
    setDirection('prev');
    setAnimating(true);
    setTimeout(() => {
      setCurrentStep(s => s - 1);
      setAnimating(false);
    }, 200);
  }, [animating, currentStep]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        completeTour();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [completeTour, goNext, goPrev]);

  const step = STEPS[currentStep];

  return (
    <div className="tour-overlay">
      <div className="tour-card" role="dialog" aria-label="Welcome tour">
        <div className={`tour-content ${animating ? `tour-content--exit-${direction}` : 'tour-content--enter'}`}>
          <StepIllustration icon={step.icon} />
          <h2 className="tour-headline">{step.headline}</h2>
          <p className="tour-description">{step.description}</p>
        </div>

        <div className="tour-footer">
          <button className="tour-skip" onClick={completeTour} title="Skip tour (Esc)">
            {isLastStep ? '' : 'Skip'}
          </button>

          <div className="tour-dots" title={`Step ${currentStep + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`tour-dot ${i === currentStep ? 'tour-dot--active' : ''} ${i < currentStep ? 'tour-dot--done' : ''}`}
                title={s.headline}
              />
            ))}
          </div>

          <button className="tour-next" onClick={goNext} title={isLastStep ? 'Close tour and start using the app' : 'Next step (→)'}>
            {isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
