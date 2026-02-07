import { useState } from 'react';
import Citations from './Citations';

export default function Answer({ data, question, onFeedback }) {
  const [expanded, setExpanded] = useState({});

  if (!data) return null;

  const { answer, follow_up_question, sources } = data;

  function toggle(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function findSourceText(docTitle, slideNumber) {
    if (!sources) return null;
    const match = sources.find(
      s => s.doc_title === docTitle && s.slide_number === slideNumber
    );
    return match ? match.text : null;
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
        <FeedbackButtons question={question} onFeedback={onFeedback} />
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
        <ul>
          {answer.map((item, i) => (
            <li key={i}>
              <div>{item.claim}</div>
              {item.citations && item.citations.length > 0 && (
                <div className="inline-citations">
                  {item.citations.map((c, j) => {
                    const key = `${i}-${c.doc_title}-${c.slide_number}`;
                    const text = findSourceText(c.doc_title, c.slide_number);
                    const isExpanded = expanded[key];

                    return (
                      <span key={j}>
                        {j > 0 && ', '}
                        <button
                          className="citation-link"
                          onClick={() => text && toggle(key)}
                          title={text ? 'Click to view slide content' : ''}
                        >
                          {c.doc_title} - {c.source_locator}
                          {text && <span className="expand-icon">{isExpanded ? ' \u25B2' : ' \u25BC'}</span>}
                        </button>
                        {isExpanded && text && (
                          <div className="slide-content">
                            <pre>{text}</pre>
                          </div>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {follow_up_question && (
        <div className="follow-up">
          <strong>Suggestion:</strong> {follow_up_question}
        </div>
      )}

      <Citations citations={collectUniqueCitations(answer)} sources={sources || []} />
      <FeedbackButtons question={question} onFeedback={onFeedback} />
    </div>
  );
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

function FeedbackButtons({ question, onFeedback }) {
  return (
    <div className="feedback-buttons">
      <span>Was this helpful?</span>
      <button onClick={() => onFeedback(question, true)} title="Helpful">
        &#128077;
      </button>
      <button onClick={() => onFeedback(question, false)} title="Not helpful">
        &#128078;
      </button>
    </div>
  );
}
