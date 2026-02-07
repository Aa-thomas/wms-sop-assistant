import { useState } from 'react';

export default function Citations({ citations, sources }) {
  const [expanded, setExpanded] = useState({});

  if (!citations || citations.length === 0) return null;

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

  return (
    <div className="citations">
      <h4>Sources</h4>
      <ul>
        {citations.map((cit, i) => {
          const key = `${cit.doc_title}-${cit.slide_number}`;
          const text = findSourceText(cit.doc_title, cit.slide_number);
          const isExpanded = expanded[key];

          return (
            <li key={i}>
              <button
                className="citation-toggle"
                onClick={() => text && toggle(key)}
                title={text ? 'Click to view slide content' : ''}
              >
                {cit.doc_title} - {cit.source_locator}
                {text && <span className="expand-icon">{isExpanded ? ' \u25B2' : ' \u25BC'}</span>}
              </button>
              {isExpanded && text && (
                <div className="slide-content">
                  <pre>{text}</pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
