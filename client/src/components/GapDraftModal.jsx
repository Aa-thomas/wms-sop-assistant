import { useState } from 'react';

export default function GapDraftModal({ gap, onClose, onRegenerate }) {
  const [copying, setCopying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(gap.sop_draft);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement('textarea');
      textarea.value = gap.sop_draft;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate(gap.id);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content gap-draft-modal" onClick={e => e.stopPropagation()}>
        <h2>SOP Draft: {gap.title}</h2>
        <button className="close-modal" onClick={onClose}>&times;</button>

        <div className="draft-content">
          <pre>{gap.sop_draft}</pre>
        </div>

        {gap.sop_draft_generated_at && (
          <div className="draft-meta">
            Generated: {new Date(gap.sop_draft_generated_at).toLocaleString()}
          </div>
        )}

        <div className="draft-actions">
          <button
            className="draft-action-btn primary"
            onClick={handleCopy}
          >
            {copying ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            className="draft-action-btn secondary"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
