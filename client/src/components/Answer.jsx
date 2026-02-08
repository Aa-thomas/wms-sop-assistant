import { useState } from 'react';
import Citations from './Citations';
import { useToast } from '../contexts/ToastContext';

export default function Answer({ data, interactionId, onFeedback }) {
  const [expanded, setExpanded] = useState({});

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
          {answer.map((item, i) => (
            <li key={i} className="step-item">
              <div className="step-title">Step {i + 1}</div>
              <div className="step-claim">{item.claim}</div>
              {item.citations && item.citations.length > 0 && (
                <div className="inline-citations">
                  <span className="step-links-label">Relevant slides:</span>
                  {collectStepCitations(item).map((c, j) => {
                    const key = `${i}-${c.doc_title}-${c.slide_number}`;
                    const source = findSource(c.doc_title, c.slide_number);
                    const isExpanded = expanded[key];
                    const label = `${c.doc_title} - ${c.source_locator || `Slide ${c.slide_number}`}`;

                    return (
                      <div key={j} className="step-link-row">
                        {source?.image_url ? (
                          <a
                            className="citation-link"
                            href={source.image_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {label}
                          </a>
                        ) : (
                          <span className="citation-text">{label}</span>
                        )}
                        {source && (
                          <button
                            className="citation-preview-btn"
                            onClick={() => toggle(key)}
                            title="Preview slide content"
                          >
                            {isExpanded ? 'Hide preview' : 'Preview'}
                          </button>
                        )}
                        {isExpanded && source && (
                          <div className="slide-content">
                            {source.image_url && (
                              <img src={source.image_url} alt={`${c.doc_title} - Slide ${c.slide_number}`} className="slide-image" />
                            )}
                            <pre>{source.text}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
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
