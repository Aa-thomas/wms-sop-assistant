import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import './AnonymousFeedbackForm.css';

export default function AnonymousFeedbackForm({ authFetch, isOpen, onClose }) {
  const [type, setType] = useState('feedback');
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      showToast('error', 'Please enter your message.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await authFetch('/feedback/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, category, message: message.trim(), urgency })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit');
      }

      showToast('success', 'Your feedback has been submitted anonymously.');
      setMessage('');
      setType('feedback');
      setCategory('other');
      setUrgency('normal');
      onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      showToast('error', error.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="feedback-modal-overlay" onClick={onClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2>Share Your Feedback</h2>
        <p className="subtitle">Your identity will remain completely anonymous</p>

        <form className="feedback-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>What would you like to share?</label>
            <div className="type-buttons">
              <button
                type="button"
                className={`type-btn ${type === 'feedback' ? 'selected' : ''}`}
                onClick={() => setType('feedback')}
              >
                <span className="icon">💬</span>
                <span>Feedback</span>
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'suggestion' ? 'selected suggestion' : ''}`}
                onClick={() => setType('suggestion')}
              >
                <span className="icon">💡</span>
                <span>Suggestion</span>
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'complaint' ? 'selected complaint' : ''}`}
                onClick={() => setType('complaint')}
              >
                <span className="icon">⚠️</span>
                <span>Complaint</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="feedback-category">Category</label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="workflow">Workflow / Processes</option>
              <option value="safety">Safety Concerns</option>
              <option value="equipment">Equipment / Tools</option>
              <option value="training">Training / Onboarding</option>
              <option value="management">Management / Supervision</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="feedback-message">Your Message</label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your feedback, suggestion, or concern in detail..."
              maxLength={2000}
            />
          </div>

          <div className="form-group">
            <label>How urgent is this?</label>
            <div className="urgency-row">
              <button
                type="button"
                className={`urgency-btn ${urgency === 'low' ? 'selected low' : ''}`}
                onClick={() => setUrgency('low')}
              >
                Low
              </button>
              <button
                type="button"
                className={`urgency-btn ${urgency === 'normal' ? 'selected normal' : ''}`}
                onClick={() => setUrgency('normal')}
              >
                Normal
              </button>
              <button
                type="button"
                className={`urgency-btn ${urgency === 'high' ? 'selected high' : ''}`}
                onClick={() => setUrgency('high')}
              >
                High
              </button>
            </div>
          </div>

          <div className="anon-notice">
            <span className="icon">🔒</span>
            <span>Your submission is completely anonymous. No identifying information is collected.</span>
          </div>

          <button type="submit" className="submit-btn" disabled={submitting || !message.trim()}>
            {submitting ? 'Submitting...' : 'Submit Anonymously'}
          </button>
        </form>
      </div>
    </div>
  );
}
