/**
 * Topology — Export Menu (Rec 6 extraction from Topology.tsx)
 */

import { memo, useCallback, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { TopologyPayload } from '../../../../shared/topology-types';
import {
  exportTopologyAsJson,
  exportTopologyAsCsv,
  exportNodesAsCsv,
  exportEdgesAsCsv,
  downloadExport,
  downloadBinaryExport,
} from '../../../../shared/topology-export';

export interface ExportMenuProps {
  payload: TopologyPayload;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
  getNodePositions?: () => Record<string, { x: number; y: number }>;
  applyNodePositions?: (positions: Record<string, { x: number; y: number }>) => void;
}

function ExportMenu({ payload, svgRef, onClose, getNodePositions, applyNodePositions }: ExportMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback((format: 'json' | 'csv' | 'nodes-csv' | 'edges-csv' | 'svg' | 'png') => {
    try {
      if (format === 'json') {
        downloadExport(exportTopologyAsJson(payload));
      } else if (format === 'csv') {
        downloadExport(exportTopologyAsCsv(payload));
      } else if (format === 'nodes-csv') {
        downloadExport(exportNodesAsCsv(payload.nodes));
      } else if (format === 'edges-csv') {
        downloadExport(exportEdgesAsCsv(payload.edges));
      } else if (format === 'svg') {
        const svg = svgRef.current;
        if (!svg) { toast.error('SVG element not available'); return; }
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        downloadExport({ format: 'svg', filename: 'topology.svg', mimeType: 'image/svg+xml', data: svgStr, exportedAt: new Date().toISOString() });
      } else if (format === 'png') {
        const svg = svgRef.current;
        if (!svg) { toast.error('SVG element not available'); return; }
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const canvas = document.createElement('canvas');
        const rect = svg.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = '#0d1117';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) downloadBinaryExport(blob, 'topology.png');
          });
        };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
      onClose();
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [payload, svgRef, onClose]);

  // ─── Layout JSON export (Slice 42) ─────────────────────
  const handleExportLayout = useCallback(() => {
    if (!getNodePositions) { toast.error('No layout data available'); return; }
    const positions = getNodePositions();
    const count = Object.keys(positions).length;
    if (count === 0) { toast.error('No node positions to export'); return; }
    const data = {
      _format: 'network-performance-topology-layout-v1',
      exportedAt: new Date().toISOString(),
      nodeCount: count,
      positions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const ts = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date()).replace(/[: ]/g, '-');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topology-layout-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported layout for ${count} nodes`);
    onClose();
  }, [getNodePositions, onClose]);

  const handleImportLayout = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ─── Layout JSON import (Slice 42) ─────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !applyNodePositions) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        if (raw._format !== 'network-performance-topology-layout-v1') {
          toast.error('Invalid layout file format');
          return;
        }
        if (!raw.positions || typeof raw.positions !== 'object') {
          toast.error('No positions found in layout file');
          return;
        }
        // Validate each position entry
        const clean: Record<string, { x: number; y: number }> = {};
        let imported = 0;
        for (const [k, v] of Object.entries(raw.positions)) {
          const pos = v as { x?: number; y?: number };
          if (typeof pos?.x === 'number' && typeof pos?.y === 'number' &&
              Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            clean[k] = { x: pos.x, y: pos.y };
            imported++;
          }
        }
        if (imported === 0) {
          toast.error('No valid positions in layout file');
          return;
        }
        applyNodePositions(clean);
        toast.success(`Imported layout for ${imported} nodes`);
        onClose();
      } catch {
        toast.error('Failed to parse layout file');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, [applyNodePositions, onClose]);

  return (
    <div
      className="absolute right-0 top-full mt-1 w-48 bg-[#161b22] border border-white/[0.08] rounded-lg shadow-xl z-30 py-1"
      data-testid="export-menu"
    >
      <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as JSON
      </button>
      <button onClick={() => handleExport('csv')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as CSV (full)
      </button>
      <button onClick={() => handleExport('nodes-csv')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export nodes CSV
      </button>
      <button onClick={() => handleExport('edges-csv')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export edges CSV
      </button>
      <div className="border-t border-white/[0.06] my-1" />
      <button onClick={() => handleExport('svg')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as SVG
      </button>
      <button onClick={() => handleExport('png')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as PNG
      </button>
      <div className="border-t border-white/[0.06] my-1" />
      <button
        onClick={handleExportLayout}
        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] flex items-center gap-1.5"
        data-testid="export-layout-json"
      >
        <Download size={11} /> Export layout JSON
      </button>
      <button
        onClick={handleImportLayout}
        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] flex items-center gap-1.5"
        data-testid="import-layout-json"
      >
        <Upload size={11} /> Import layout JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
        data-testid="import-layout-input"
      />
    </div>
  );
}

export default memo(ExportMenu);
