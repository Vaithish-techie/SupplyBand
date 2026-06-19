import { BaseEdge, getBezierPath } from '@xyflow/react';

export default function AnimatedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isAnimating = data?.isAnimating;
  const findingLabel = data?.findingLabel;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {isAnimating && findingLabel && (
        <circle r="4" fill="#646cff">
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {/* We can use foreignObject or a div over the edge for the text label. 
          For simplicity, an animated SVG text element moving along the path: */}
      {isAnimating && findingLabel && (
        <text className="edge-finding-label" dy="-10">
          <textPath href={`#edge-path-${data.id}`} startOffset="50%" textAnchor="middle">
            {findingLabel}
          </textPath>
        </text>
      )}
      {/* Hidden path for text layout if needed */}
      {isAnimating && findingLabel && (
        <path id={`edge-path-${data.id}`} d={edgePath} fill="none" stroke="none" />
      )}
    </>
  );
}
