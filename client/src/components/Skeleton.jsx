import './Skeleton.css';

export function SkeletonLine({ width, height, style }) {
  return <div className="skeleton-line" style={{ width, height, ...style }} />;
}

export function SkeletonAnswer() {
  return (
    <div className="skeleton-answer">
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine />
    </div>
  );
}

export function SkeletonStep() {
  return (
    <div className="skeleton-step">
      <SkeletonLine className="skeleton-title" style={{ height: '1.5rem', width: '60%' }} />
      <div className="skeleton-paragraph">
        <SkeletonLine style={{ width: '100%' }} />
        <SkeletonLine style={{ width: '95%' }} />
        <SkeletonLine style={{ width: '80%' }} />
      </div>
      <div className="skeleton-paragraph">
        <SkeletonLine style={{ width: '100%' }} />
        <SkeletonLine style={{ width: '85%' }} />
      </div>
    </div>
  );
}

export function SkeletonModuleCard() {
  return (
    <div className="skeleton-module-card">
      <SkeletonLine style={{ height: '1.25rem', width: '50%' }} />
      <SkeletonLine style={{ height: '0.9rem', width: '30%' }} />
      <SkeletonLine style={{ height: '0.9rem', width: '80%' }} />
      <SkeletonLine style={{ height: '0.9rem', width: '65%' }} />
      <SkeletonLine style={{ height: '2.5rem', width: '100%', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)' }} />
    </div>
  );
}

export function SkeletonSummaryCard() {
  return (
    <div className="skeleton-summary-card">
      <SkeletonLine style={{ height: '1.25rem', width: '55%' }} />
      <div className="skeleton-metric">
        <SkeletonLine style={{ height: '1.5rem', width: '2rem' }} />
        <SkeletonLine style={{ height: '0.9rem', width: '4rem' }} />
      </div>
      <div className="skeleton-metric">
        <SkeletonLine style={{ height: '1.5rem', width: '2rem' }} />
        <SkeletonLine style={{ height: '0.9rem', width: '4rem' }} />
      </div>
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="skeleton-table-row">
      <td><SkeletonLine /></td>
      <td><SkeletonLine /></td>
      <td><SkeletonLine /></td>
      <td><SkeletonLine /></td>
      <td><SkeletonLine /></td>
      <td><SkeletonLine /></td>
      <td><SkeletonLine /></td>
      <td><SkeletonLine /></td>
    </tr>
  );
}
