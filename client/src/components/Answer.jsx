import { useState } from 'react';
import Citations from './Citations';
import { useToast } from '../contexts/ToastContext';

export default function Answer({ data, interactionId, onFeedback }) {
  const [expanded, setExpanded] = useState({});
  const [missingImages, setMissingImages] = useState({});

  if (!data) return null;

  const { answer, follow_up_question, sources } = data;

  function toggle(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function findSource(docTitle, slideNumber) {
    if (!sources) return null;
    return sources.find(
      s => s.doc_title === docTitle && s.slide_number === slideNumber
    ) || null;
  }

  // Handle string answer (e.g., "Not found in SOPs")
  if (typeof answer === 'string') {
    return (
      <div className="answer">
        <div className="answer-claims">
          <p className="not-found">{answer}</p>
        </div>
        {follow_up_question && (
          <div className="follow-up">
            <strong>Suggestion:</strong> {follow_up_question}
          </div>
        )}
        <FeedbackButtons interactionId={interactionId} onFeedback={onFeedback} />
      </div>
    );
  }

  // Handle array answer
  if (!Array.isArray(answer) || answer.length === 0) {
    return (
      <div className="answer">
        <p className="not-found">No answer available. Please try rephrasing your question.</p>
      </div>
    );
  }

  return (
    <div className="answer">
      <div className="answer-claims">
        <ol className="step-list">
          {answer.map((item, i) => {
            const stepSources = collectStepSources(item, sources || []);
            const hasSlides = stepSources.length > 0;
            const isExpanded = !!expanded[`step-${i}`];

            return (
            <li
              key={i}
              className={`step-item ${hasSlides ? 'has-slide' : ''} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => hasSlides && toggle(`step-${i}`)}
              onKeyDown={(e) => {
                if (hasSlides && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggle(`step-${i}`);
                }
              }}
              role={hasSlides ? 'button' : undefined}
              tabIndex={hasSlides ? 0 : undefined}
            >
              <div className="step-head">
                <div className="step-index">{i + 1}</div>
                <div className="step-body">
                  <div className="step-claim">{item.claim}</div>
                  {collectStepCitations(item).length > 0 && (
                    <div className="inline-citations">
                      {collectStepCitations(item).map((c, j) => {
                        const label = `${c.doc_title} - ${c.source_locator || `Slide ${c.slide_number}`}`;
                        const source = findSource(c.doc_title, c.slide_number);

                        return source?.image_url ? (
                          <button
                            key={j}
                            type="button"
                            className="citation-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(`step-${i}`);
                            }}
                          >
                            {label}
                          </button>
                        ) : (
                          <span key={j} className="citation-text">{label}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {hasSlides && (
                  <div className="step-chevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              {isExpanded && (
                <div className="step-slide-panel">
                  {stepSources.map((entry, j) => (
                    <div key={j} className="slide-content">
                      <div className="step-slide-label">
                        {entry.citation.doc_title} - {entry.citation.source_locator || `Slide ${entry.citation.slide_number}`}
                      </div>
                      {entry.source.image_url && (
                        <img
                          src={entry.source.image_url}
                          alt={`${entry.citation.doc_title} - Slide ${entry.citation.slide_number}`}
                          className="slide-image"
                          onError={() => setMissingImages(prev => ({ ...prev, [entry.source.image_url]: true }))}
                          style={missingImages[entry.source.image_url] ? { display: 'none' } : undefined}
                        />
                      )}
                      <pre>{entry.source.text}</pre>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
          })}
        </ol>
      </div>

      {follow_up_question && (
        <div className="follow-up">
          <strong>Suggestion:</strong> {follow_up_question}
        </div>
      )}

      <Citations citations={collectUniqueCitations(answer)} sources={sources || []} />
      <FeedbackButtons interactionId={interactionId} onFeedback={onFeedback} />
    </div>
  );
}

function collectStepSources(item, sources) {
  const seen = new Set();
  const rows = [];
  (item.citations || []).forEach(c => {
    const key = `${c.doc_title}-${c.slide_number}`;
    if (seen.has(key)) return;
    seen.add(key);
    const source = sources.find(
      s => s.doc_title === c.doc_title && s.slide_number === c.slide_number
    );
    if (source) rows.push({ citation: c, source });
  });
  return rows;
}

function collectStepCitations(item) {
  const unique = new Set();
  const citations = [];
  (item.citations || []).forEach(c => {
    const key = `${c.doc_title}-${c.slide_number}`;
    if (!unique.has(key)) {
      unique.add(key);
      citations.push(c);
    }
  });
  return citations;
}

function collectUniqueCitations(answer) {
  const seen = new Set();
  const citations = [];
  answer.forEach(item => {
    if (item.citations) {
      item.citations.forEach(cit => {
        const key = `${cit.doc_title}-${cit.slide_number}`;
        if (!seen.has(key)) {
          seen.add(key);
          citations.push(cit);
        }
      });
    }
  });
  return citations;
}

function FeedbackButtons({ interactionId, onFeedback }) {
  const [selected, setSelected] = useState(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const { showToast } = useToast();

  if (!interactionId) return null;

  const handleThumbsUp = () => {
    setSelected(true);
    setShowCommentInput(false);
    onFeedback(interactionId, true);
    showToast('success', 'Thanks for your feedback!', 2000);
  };

  const handleThumbsDown = () => {
    setSelected(false);
    setShowCommentInput(true);
  };

  const handleCommentSubmit = () => {
    onFeedback(interactionId, false, comment);
    setShowCommentInput(false);
    showToast('success', 'Thanks for your feedback!', 2000);
  };

  return (
    <div className="feedback-buttons">
      <span>Was this helpful?</span>
      <button
        onClick={handleThumbsUp}
        className={selected === true ? 'selected' : ''}
        disabled={selected !== null}
        title="Helpful"
      >
        &#128077;
      </button>
      <button
        onClick={handleThumbsDown}
        className={selected === false ? 'selected' : ''}
        disabled={selected !== null}
        title="Not helpful"
      >
        &#128078;
      </button>
      {showCommentInput && (
        <div className="feedback-comment">
          <input
            type="text"
            placeholder="What was wrong? (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCommentSubmit()}
          />
          <button onClick={handleCommentSubmit}>Submit</button>
        </div>
      )}
    </div>
  );
}
