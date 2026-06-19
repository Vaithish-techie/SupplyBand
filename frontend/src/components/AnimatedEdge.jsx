import { BaseEdge, getBezierPath } from '@xyflow/react';

/**
 * AnimatedEdge — premium "war room" version.
 * Inactive: faint amber-gold stroke.
 * Active:   brighter gold particle traveling along path.
 */
export default function AnimatedEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {}, markerEnd, data
}) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isAnimating  = data?.isAnimating;
  const findingLabel = data?.findingLabel;
  const edgeId       = `edge-path-${data?.id || Math.random()}`;

  return (
    <>
      {/* Base path — always visible */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isAnimating ? 'rgba(200,150,10,0.5)' : 'rgba(255,255,255,0.06)',
          strokeWidth: isAnimating ? 1.5 : 1,
          transition: 'stroke 0.4s ease, stroke-width 0.4s ease',
        }}
      />

      {/* Traveling particle */}
      {isAnimating && (
        <circle r="3.5" fill="#C8960A" style={{ filter: 'drop-shadow(0 0 4px #C8960A)' }}>
          <animateMotion dur="2.2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Finding label along path */}
      {isAnimating && findingLabel && (
        <>
          <path id={edgeId} d={edgePath} fill="none" stroke="none" />
          <text dy="-8" style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fill: 'rgba(200,150,10,0.7)', letterSpacing: '0.04em' }}>
            <textPath href={`#${edgeId}`} startOffset="50%" textAnchor="middle">
              {findingLabel}
            </textPath>
          </text>
        </>
      )}
    </>
  );
}
