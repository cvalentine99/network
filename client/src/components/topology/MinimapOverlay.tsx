/**
 * Topology ForceGraph — Minimap overlay (canvas-based inset)
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { select } from 'd3-selection';
import { zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { SimNode, SimLink } from './types';
import { ROLE_DISPLAY } from '../../../../shared/topology-types';
import { MINIMAP_WIDTH, MINIMAP_HEIGHT, MINIMAP_PADDING } from './constants';

interface MinimapOverlayProps {
  nodes: SimNode[];
  links: SimLink[];
  selectedNodeId: number | null;
  clusterColorMap: Map<string, string>;
  transform: { x: number; y: number; k: number };
  dimensions: { width: number; height: number };
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoomBehaviorRef: React.MutableRefObject<ZoomBehavior<SVGSVGElement, unknown> | null>;
}

function MinimapOverlay({
  nodes,
  links,
  selectedNodeId,
  clusterColorMap,
  transform,
  dimensions,
  svgRef,
  zoomBehaviorRef,
}: MinimapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (nodes.length === 0) return;

    // Compute bounding box of all nodes
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x - n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }
    if (!Number.isFinite(minX)) return;

    const pad = 30;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scaleX = MINIMAP_WIDTH / worldW;
    const scaleY = MINIMAP_HEIGHT / worldH;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Border
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw edges
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
    ctx.lineWidth = 0.5;
    for (const link of links) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.x == null || tgt.x == null) continue;
      ctx.beginPath();
      ctx.moveTo((src.x - minX) * scale + offsetX, (src.y! - minY) * scale + offsetY);
      ctx.lineTo((tgt.x - minX) * scale + offsetX, (tgt.y! - minY) * scale + offsetY);
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const nx = (n.x - minX) * scale + offsetX;
      const ny = (n.y - minY) * scale + offsetY;
      const nr = Math.max(n.radius * scale, 1.5);
      const color = n.isSuperNode
        ? clusterColorMap.get(n.clusterId) || '#94a3b8'
        : ROLE_DISPLAY[n.node.role]?.color || '#94a3b8';
      ctx.fillStyle = color;
      ctx.globalAlpha = n.id === selectedNodeId ? 1 : 0.7;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw viewport rectangle
    const vx = (-transform.x / transform.k - minX) * scale + offsetX;
    const vy = (-transform.y / transform.k - minY) * scale + offsetY;
    const vw = (dimensions.width / transform.k) * scale;
    const vh = (dimensions.height / transform.k) * scale;

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
    ctx.fillRect(vx, vy, vw, vh);

    // Store world bounds for click-to-navigate
    (canvas as any)._worldBounds = { minX, minY, worldW, worldH, scale, offsetX, offsetY };
  // PERF-C4: Add dependency array to prevent re-render on every frame
  }, [nodes, links, selectedNodeId, clusterColorMap, transform, dimensions]);

  // Click-to-navigate
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !svgRef.current || !zoomBehaviorRef.current) return;
      const bounds = (canvas as any)._worldBounds;
      if (!bounds) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap coords to world coords
      const worldX = (clickX - bounds.offsetX) / bounds.scale + bounds.minX;
      const worldY = (clickY - bounds.offsetY) / bounds.scale + bounds.minY;

      // Center the main view on this world position
      const newX = dimensions.width / 2 - worldX * transform.k;
      const newY = dimensions.height / 2 - worldY * transform.k;

      select(svgRef.current)
        .transition()
        .duration(300)
        .call(
          zoomBehaviorRef.current.transform,
          zoomIdentity.translate(newX, newY).scale(transform.k)
        );
    },
    [dimensions, transform, svgRef, zoomBehaviorRef]
  );

  return (
    <div
      className="absolute z-40"
      style={{
        right: MINIMAP_PADDING,
        bottom: MINIMAP_PADDING,
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
      data-testid="topology-minimap"
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        style={{ cursor: 'crosshair', display: 'block' }}
        onClick={handleMinimapClick}
        data-testid="minimap-canvas"
      />
    </div>
  );
}

// PERF-C2: Memoize canvas sub-component to prevent re-render on every simulation tick
export default React.memo(MinimapOverlay);
