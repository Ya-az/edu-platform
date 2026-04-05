import './ProgressBar.css';

export default function ProgressBar({ value, max = 100, color, height = 8, showLabel = false }) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  const barColor = color || 'var(--color-primary)';

  return (
    <div className="progress-wrapper">
      <div className="progress-bar" style={{ height }}>
        <div
          className="progress-fill"
          style={{ width: `${percentage}%`, background: barColor }}
        />
      </div>
      {showLabel && <span className="progress-label">{percentage}%</span>}
    </div>
  );
}
