import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import GapDraftModal from './GapDraftModal';
import './GapAnalysis.css';

const SEVERITY_ORDER = { high: 1, medium: 2, low: 3 };

export default function GapAnalysis({ authFetch }) {
  const [report, setReport] = useState({ run: null, gaps: [] });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [draftGap, setDraftGap] = useState(null);
  const [expandedGaps, setExpandedGaps] = useState(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const res = await authFetch('/gaps/report');
      const data = await res.json();
      setReport(data);
    } catch (error) {
      console.error('Failed to load gap report:', error);
      showToast('error', 'Failed to load gap report.');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await authFetch('/gaps/analyze', {
        method: 'POST',
        body: JSON.stringify({ period_days: 30 })
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      showToast('success', `Analysis complete: ${data.gaps.length} gaps found from ${data.totalInteractions} interactions.`);
      await loadReport();
    } catch (error) {
      console.error('Gap analysis failed:', error);
      showToast('error', 'Gap analysis failed. Check server logs.');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateGapStatus = async (gapId, status) => {
    try {
      const res = await authFetch(`/gaps/${gapId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Update failed');
      setReport(prev => ({
        ...prev,
        gaps: prev.gaps.map(g =>
          g.id === gapId ? { ...g, status, resolved_at: status === 'resolved' ? new Date().toISOString() : null } : g
        )
      }));
      showToast('success', `Gap ${status}.`);
    } catch (error) {
      console.error('Failed to update gap:', error);
      showToast('error', 'Failed to update gap status.');
    }
  };

  const generateDraft = async (gapId) => {
    try {
      const res = await authFetch(`/gaps/${gapId}/draft`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Draft generation failed');
      const data = await res.json();
      // Update local state
      setReport(prev => ({
        ...prev,
        gaps: prev.gaps.map(g =>
          g.id === gapId ? { ...g, sop_draft: data.draft, sop_draft_generated_at: new Date().toISOString() } : g
        )
      }));
      // Show draft in modal
      const gap = report.gaps.find(g => g.id === gapId);
      setDraftGap({ ...gap, sop_draft: data.draft, sop_draft_generated_at: new Date().toISOString() });
      showToast('success', 'SOP draft generated.');
    } catch (error) {
      console.error('Draft generation failed:', error);
      showToast('error', 'Failed to generate SOP draft.');
    }
  };

  const handleRegenerate = async (gapId) => {
    await generateDraft(gapId);
    // Update modal with new draft
    const updatedGap = report.gaps.find(g => g.id === gapId);
    if (updatedGap) setDraftGap(updatedGap);
  };

  const toggleExpand = (gapId) => {
    setExpandedGaps(prev => {
      const next = new Set(prev);
      if (next.has(gapId)) next.delete(gapId);
      else next.add(gapId);
      return next;
    });
  };

  const sortedGaps = [...report.gaps].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] || 9) - (SEVERITY_ORDER[b.severity] || 9);
    if (sevDiff !== 0) return sevDiff;
    return b.question_count - a.question_count;
  });

  if (loading) {
    return <div className="gap-analysis-loading">Loading gap analysis...</div>;
  }

  return (
    <div className="gap-analysis">
      <div className="gap-toolbar">
        <div className="gap-toolbar-left">
          <button
            className="run-analysis-btn"
            onClick={runAnalysis}
            disabled={analyzing}
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
          {report.run && (
            <span className="last-run-info">
              Last run: {new Date(report.run.completed_at).toLocaleString()}
              {' '}&middot; {report.run.total_interactions} interactions &middot; {report.run.gaps_found} gaps
            </span>
          )}
        </div>
      </div>

      {sortedGaps.length === 0 && (
        <div className="no-data">
          {report.run
            ? 'No knowledge gaps found in the latest analysis. Great coverage!'
            : 'No analysis has been run yet. Click "Run Analysis" to scan for knowledge gaps.'}
        </div>
      )}

      <div className="gap-cards">
        {sortedGaps.map(gap => (
          <div key={gap.id} className={`gap-card gap-severity-${gap.severity} gap-status-${gap.status}`}>
            <div className="gap-card-header">
              <div className="gap-title-row">
                <h3>{gap.title}</h3>
                <div className="gap-badges">
                  <span className={`severity-badge ${gap.severity}`}>{gap.severity}</span>
                  {gap.suggested_module && (
                    <span className="module-badge">{gap.suggested_module}</span>
                  )}
                  {gap.status !== 'open' && (
                    <span className={`status-tag ${gap.status}`}>{gap.status}</span>
                  )}
                </div>
              </div>
              {gap.description && <p className="gap-description">{gap.description}</p>}
            </div>

            <div className="gap-card-meta">
              <span className="question-count">{gap.question_count} questions</span>
              <button
                className="expand-btn"
                onClick={() => toggleExpand(gap.id)}
              >
                {expandedGaps.has(gap.id) ? 'Hide questions' : 'Show questions'}
              </button>
            </div>

            {expandedGaps.has(gap.id) && (
              <ul className="sample-questions">
                {gap.sample_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            )}

            <div className="gap-card-actions">
              {gap.sop_draft ? (
                <button className="gap-btn primary" onClick={() => setDraftGap(gap)}>
                  View Draft
                </button>
              ) : (
                <button className="gap-btn primary" onClick={() => generateDraft(gap.id)}>
                  Generate SOP Draft
                </button>
              )}
              {gap.status === 'open' && (
                <>
                  <button className="gap-btn secondary" onClick={() => updateGapStatus(gap.id, 'dismissed')}>
                    Dismiss
                  </button>
                  <button className="gap-btn secondary" onClick={() => updateGapStatus(gap.id, 'resolved')}>
                    Mark Resolved
                  </button>
                </>
              )}
              {gap.status === 'dismissed' && (
                <button className="gap-btn secondary" onClick={() => updateGapStatus(gap.id, 'open')}>
                  Reopen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {draftGap && (
        <GapDraftModal
          gap={draftGap}
          onClose={() => setDraftGap(null)}
          onRegenerate={handleRegenerate}
        />
      )}
    </div>
  );
}
