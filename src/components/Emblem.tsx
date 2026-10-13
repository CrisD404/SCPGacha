/** Emblema de la Fundación (dibujado a mano en SVG; el logo SCP original es CC BY-SA 3.0). */
export function Emblem({ className = '', size }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="-100 -100 200 200" aria-hidden="true">
      <circle r="84" fill="none" stroke="currentColor" strokeWidth="11" />
      <circle r="46" fill="none" stroke="currentColor" strokeWidth="11" />
      {[0, 120, 240].map((r) => (
        <path key={r} transform={`rotate(${r})`} d="M-11 -100 h22 v35 h15 l-26 32 l-26 -32 h15 z" fill="currentColor" />
      ))}
      <circle r="14" fill="var(--emblem-core, #ff3b4e)" />
    </svg>
  );
}
