// Dependency-free bar chart — the data here is just N buckets with a
// count each, not worth pulling in a charting library for.
export default function BarChart({ data, title }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bar-chart-wrap">
      {title && <div className="bar-chart-title">{title}</div>}
      <div className="bar-chart">
        {data.map((d, i) => (
          <div key={i} className="bar-chart-col" title={`${d.label}: ${d.value}`}>
            <span className="bar-chart-value">{d.value > 0 ? d.value : ''}</span>
            <div className="bar-chart-bar" style={{ height: `${(d.value / max) * 100}%` }} />
            <span className="bar-chart-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
