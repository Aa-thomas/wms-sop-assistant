import { useState } from 'react';

export default function Citations({ citations, sources }) {
  const [expanded, setExpanded] = useState({});

  if (!citations || citations.length === 0) return null;

  function toggle(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function findSource(docTitle, slideNumber) {
    if (!sources) return null;
    return sources.find(
      s => s.doc_title === docTitle && s.slide_number === slideNumber
    ) || null;
  }

  return (
    <div className="citations">
      <h4>Sources</h4>
      <ul>
        {citations.map((cit, i) => {
          const key = `${cit.doc_title}-${cit.slide_number}`;
          const source = findSource(cit.doc_title, cit.slide_number);
          const isExpanded = expanded[key];

          return (
            <li key={i}>
              <button
                className="citation-toggle"
                onClick={() => source && toggle(key)}
                title={source ? 'Click to view slide content' : ''}
              >
                {cit.doc_title} - {cit.source_locator}
                {source && <span className="expand-icon">{isExpanded ? ' \u25B2' : ' \u25BC'}</span>}
              </button>
              {isExpanded && source && (
                <div className="slide-content">
                  {source.image_url && (
                    <img src={source.image_url} alt={`${cit.doc_title} - Slide ${cit.slide_number}`} className="slide-image" />
                  )}
                  <pre>{source.text}</pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
