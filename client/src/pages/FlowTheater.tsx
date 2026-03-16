/**
 * FlowTheater.tsx — Slice 17
 *
 * Dedicated surface: "Where is the time going?"
 * Entry form → SSE trace → 8-step rail → summary card.
 *
 * Entry modes: hostname | device ID | IP address | service-row key
 * SSE events: step | heartbeat | complete | error
 * Terminal states: complete | quiet | error
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Server,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOLD, MUTED, BRIGHT, CYAN, GREEN } from "@/components/DashboardWidgets";
import { useTimeWindow } from "@/lib/useTimeWindow";
import CrossSurfaceNavButton from '@/components/CrossSurfaceNavButton';
import { buildFlowTheaterToBlastRadiusLink } from '../../../shared/cross-surface-nav-types';
import { useFlowTheaterNavParams } from '@/hooks/useNavParams';
import type {
  TraceEntryMode,
  TraceRunState,
  TraceSSEEvent,
  TraceStepId,
  TraceStepSnapshot,
} from "../../../shared/flow-theater-types";
import {
  TRACE_STEPS,
  buildInitialTraceRunState,
  applyTraceEvent,
} from "../../../shared/flow-theater-types";
import { TraceSSEEventSchema } from "../../../shared/flow-theater-validators";

// ─── Constants ──────────────────────────────────────────────────────────────

const RED = "oklch(0.628 0.258 29.234)";
const AMBER = "oklch(0.769 0.188 70.08)";

const ENTRY_MODE_LABELS: Record<TraceEntryMode, string> = {
  hostname: "Hostname",
  device: "Device ID",
  "service-row": "Service Row",
  ip: "IP Address",
  cidr: "Subnet (CIDR)",
};

const ENTRY_MODE_PLACEHOLDERS: Record<TraceEntryMode, string> = {
  hostname: "e.g. dc01.lab.local",
  device: "e.g. 1042",
  "service-row": "e.g. SMB::1042",
  ip: "e.g. 10.1.20.42",
  cidr: "e.g. 10.1.20.0/24",
};

// ─── Step Status Styling ────────────────────────────────────────────────────

function stepColor(status: TraceStepSnapshot["status"]): string {
  switch (status) {
    case "idle":
      return MUTED;
    case "running":
      return GOLD;
    case "complete":
      return GREEN;
    case "quiet":
      return AMBER;
    case "error":
      return RED;
    default:
      return MUTED;
  }
}

function StepIcon({
  status,
  size = 16,
}: {
  status: TraceStepSnapshot["status"];
  size?: number;
}) {
  const color = stepColor(status);
  switch (status) {
    case "idle":
      return (
        <div
          className="rounded-full border-2"
          style={{
            width: size,
            height: size,
            borderColor: MUTED,
            opacity: 0.4,
          }}
        />
      );
    case "running":
      return <Loader2 size={size} style={{ color }} className="animate-spin" />;
    case "complete":
      return <CheckCircle2 size={size} style={{ color }} />;
    case "quiet":
      return <AlertTriangle size={size} style={{ color }} />;
    case "error":
      return <XCircle size={size} style={{ color }} />;
    default:
      return null;
  }
}

// ─── SSE Hook ───────────────────────────────────────────────────────────────

function useTraceSSE() {
  const [traceState, setTraceState] = useState<TraceRunState>(
    buildInitialTraceRunState
  );
  const abortRef = useRef<AbortController | null>(null);

  const startTrace = useCallback(
    async (mode: TraceEntryMode, value: string, timeWindow: ReturnType<typeof useTimeWindow>["window"]) => {
      // Abort any existing trace
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset to initial state then set running
      setTraceState({
        ...buildInitialTraceRunState(),
        status: "running",
        intent: {
          mode,
          value,
          timeWindow,
        },
      });

      try {
        const response = await fetch("/api/bff/trace/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, value, timeWindow }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setTraceState((prev) => ({
            ...prev,
            status: "error",
            errorMessage: `HTTP ${response.status}: ${response.statusText}`,
          }));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;

          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const validated = TraceSSEEventSchema.safeParse(parsed);
              if (validated.success) {
                const event: TraceSSEEvent = validated.data;
                setTraceState((prev) => applyTraceEvent(prev, event));
              }
            } catch {
              // Skip malformed SSE data lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — don't update state
          return;
        }
        setTraceState((prev) => ({
          ...prev,
          status: "error",
          errorMessage:
            err instanceof Error ? err.message : "Unknown transport error",
        }));
      }
    },
    []
  );

  const resetTrace = useCallback(() => {
    abortRef.current?.abort();
    setTraceState(buildInitialTraceRunState());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { traceState, startTrace, resetTrace };
}

// ─── Flow Theater Page ──────────────────────────────────────────────────────

export default function FlowTheater() {
  const [entryMode, setEntryMode] = useState<TraceEntryMode>("hostname");
  const [inputValue, setInputValue] = useState("");
  const { window: timeWindow } = useTimeWindow();
  const { traceState, startTrace, resetTrace } = useTraceSSE();
  const navParams = useFlowTheaterNavParams();
  const navConsumedRef = useRef(false);

  // Consume cross-surface nav params on mount
  useEffect(() => {
    if (navParams && !navConsumedRef.current) {
      navConsumedRef.current = true;
      setEntryMode(navParams.mode as TraceEntryMode);
      setInputValue(navParams.value);
    }
  }, [navParams]);

  // Auto-submit after nav params are consumed
  const autoSubmitRef = useRef(false);
  useEffect(() => {
    if (navParams?.autoSubmit && navConsumedRef.current && !autoSubmitRef.current && inputValue === navParams.value) {
      autoSubmitRef.current = true;
      const timer = setTimeout(() => {
        startTrace(navParams.mode as TraceEntryMode, navParams.value, timeWindow);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [navParams, inputValue, timeWindow, startTrace]);

  const isRunning = traceState.status === "running";
  const isTerminal =
    traceState.status === "complete" ||
    traceState.status === "quiet" ||
    traceState.status === "error";
  const canSubmit = inputValue.trim().length > 0 && !isRunning;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      startTrace(entryMode, inputValue.trim(), timeWindow);
    },
    [canSubmit, entryMode, inputValue, timeWindow, startTrace]
  );

  const handleReset = useCallback(() => {
    resetTrace();
    setInputValue("");
  }, [resetTrace]);

  // Count completed steps
  const completedSteps = useMemo(
    () =>
      Object.values(traceState.steps).filter(
        (s) => s.status === "complete" || s.status === "quiet"
      ).length,
    [traceState.steps]
  );

  return (
    <div className="space-y-6" data-testid="flow-theater-page">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6" style={{ color: GOLD }} />
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: BRIGHT }}
          >
            Flow Theater
          </h1>
          <p className="text-sm" style={{ color: MUTED }}>
            Where is the time going? Trace a device through all ExtraHop data
            sources.
          </p>
        </div>
      </div>

      {/* Entry Form */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "oklch(0.12 0.005 260 / 60%)",
          border: "1px solid oklch(1 0 0 / 8%)",
        }}
        data-testid="trace-entry-form"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Entry Mode Selector */}
            <div className="w-full sm:w-48">
              <Label
                className="text-xs font-medium uppercase tracking-wider mb-2 block"
                style={{ color: MUTED }}
              >
                Entry Mode
              </Label>
              <Select
                value={entryMode}
                onValueChange={(v) => setEntryMode(v as TraceEntryMode)}
                disabled={isRunning}
              >
                <SelectTrigger
                  className="h-10"
                  style={{
                    background: "oklch(0.08 0.005 260)",
                    borderColor: "oklch(1 0 0 / 12%)",
                  }}
                  data-testid="entry-mode-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hostname">Hostname</SelectItem>
                  <SelectItem value="device">Device ID</SelectItem>
                  <SelectItem value="service-row">Service Row</SelectItem>
                  <SelectItem value="ip">IP Address</SelectItem>
                  <SelectItem value="cidr">Subnet (CIDR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Input Value */}
            <div className="flex-1">
              <Label
                className="text-xs font-medium uppercase tracking-wider mb-2 block"
                style={{ color: MUTED }}
              >
                {ENTRY_MODE_LABELS[entryMode]}
              </Label>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={ENTRY_MODE_PLACEHOLDERS[entryMode]}
                disabled={isRunning}
                className="h-10"
                style={{
                  background: "oklch(0.08 0.005 260)",
                  borderColor: "oklch(1 0 0 / 12%)",
                  fontFamily: "var(--font-mono)",
                }}
                data-testid="trace-input"
              />
            </div>

            {/* Submit / Reset */}
            <div className="flex items-end gap-2">
              {!isTerminal ? (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-10 px-6"
                  style={{
                    background: canSubmit ? GOLD : MUTED,
                    color: "oklch(0.1 0 0)",
                  }}
                  data-testid="trace-submit"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isRunning ? "Tracing…" : "Run Trace"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleReset}
                  variant="outline"
                  className="h-10 px-6"
                  style={{ borderColor: "oklch(1 0 0 / 12%)" }}
                  data-testid="trace-reset"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  New Trace
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* 8-Step Rail */}
      {traceState.status !== "idle" && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "oklch(0.12 0.005 260 / 60%)",
            border: "1px solid oklch(1 0 0 / 8%)",
          }}
          data-testid="trace-rail"
        >
          {/* Rail Header */}
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: MUTED }}
            >
              Trace Progress
            </h2>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-mono"
                style={{ color: MUTED }}
              >
                {completedSteps}/{TRACE_STEPS.length} steps
              </span>
              {traceState.totalDurationMs != null && (
                <span
                  className="text-xs font-mono"
                  style={{ color: GOLD }}
                  data-testid="trace-total-duration"
                >
                  {(traceState.totalDurationMs / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          </div>

          {/* Step Items */}
          <div className="space-y-1" data-testid="trace-steps-container">
            {TRACE_STEPS.map((stepDef, idx) => {
              const snapshot = traceState.steps[stepDef.id];
              const isSerial = stepDef.serial;
              const showFanOutIndicator =
                idx === 3 && !isSerial; // First parallel step

              return (
                <div key={stepDef.id}>
                  {showFanOutIndicator && (
                    <div
                      className="flex items-center gap-2 py-1 pl-6"
                      style={{ color: MUTED }}
                    >
                      <ChevronRight className="h-3 w-3" />
                      <span className="text-[10px] uppercase tracking-widest font-medium">
                        Parallel fan-out
                      </span>
                    </div>
                  )}
                  <StepRailItem
                    stepId={stepDef.id}
                    label={stepDef.label}
                    index={stepDef.index}
                    snapshot={snapshot}
                    serial={isSerial}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {traceState.status === "error" && traceState.errorMessage && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background: "oklch(0.628 0.258 29.234 / 10%)",
            border: "1px solid oklch(0.628 0.258 29.234 / 30%)",
          }}
          data-testid="trace-error-banner"
        >
          <XCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: RED }} />
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: RED }}
            >
              Trace Failed
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: MUTED }}
            >
              {traceState.errorMessage}
            </p>
          </div>
        </div>
      )}

      {/* Quiet State Banner */}
      {traceState.status === "quiet" && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background: "oklch(0.769 0.188 70.08 / 10%)",
            border: "1px solid oklch(0.769 0.188 70.08 / 30%)",
          }}
          data-testid="trace-quiet-banner"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 mt-0.5"
            style={{ color: AMBER }}
          />
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: AMBER }}
            >
              Trace Quiet
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: MUTED }}
            >
              The trace completed but found no meaningful data for this device in
              the selected time window.
            </p>
          </div>
        </div>
      )}

      {/* Summary Card */}
      {traceState.summary && (
        <div
          className="rounded-xl p-5"
          style={{
            background: "oklch(0.12 0.005 260 / 60%)",
            border: `1px solid ${
              traceState.status === "complete"
                ? "oklch(0.723 0.219 149.579 / 30%)"
                : "oklch(1 0 0 / 8%)"
            }`,
          }}
          data-testid="trace-summary-card"
        >
          <h2
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: MUTED }}
          >
            Trace Summary
          </h2>

          {/* Resolved Device */}
          {traceState.summary.resolvedDevice && (
            <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
              <Server className="h-5 w-5" style={{ color: CYAN }} />
              <div className="flex-1">
                <p
                  className="text-sm font-medium"
                  style={{ color: BRIGHT, fontFamily: "var(--font-mono)" }}
                >
                  {traceState.summary.resolvedDevice.device.displayName}
                </p>
                <p className="text-xs" style={{ color: MUTED }}>
                  {traceState.summary.resolvedDevice.device.ipaddr} ·{" "}
                  {traceState.summary.resolvedDevice.device.role} ·{" "}
                  Resolved via {traceState.summary.resolvedDevice.resolvedVia}
                </p>
              </div>
              <CrossSurfaceNavButton
                link={buildFlowTheaterToBlastRadiusLink(
                  traceState.summary.resolvedDevice.device.displayName,
                  traceState.summary.resolvedDevice.device.id,
                )}
              />
            </div>
          )}

          {/* Counts Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <SummaryMetric
              label="Activity"
              value={traceState.summary.activityCount}
            />
            <SummaryMetric
              label="Metrics"
              value={traceState.summary.metricPointCount}
            />
            <SummaryMetric
              label="Records"
              value={traceState.summary.recordCount}
            />
            <SummaryMetric
              label="Detections"
              value={traceState.summary.detectionCount}
            />
            <SummaryMetric
              label="Alerts"
              value={traceState.summary.alertCount}
            />
          </div>

          {/* Step Timings */}
          {traceState.summary.stepTimings.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}>
              <p
                className="text-xs font-medium uppercase tracking-wider mb-2"
                style={{ color: MUTED }}
              >
                Step Timings
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {traceState.summary.stepTimings.map((st) => {
                  const def = TRACE_STEPS.find((s) => s.id === st.stepId);
                  return (
                    <div
                      key={st.stepId}
                      className="flex items-center justify-between px-2 py-1 rounded"
                      style={{ background: "oklch(0.08 0.005 260)" }}
                    >
                      <span
                        className="text-[11px] truncate"
                        style={{ color: MUTED }}
                      >
                        {def?.label ?? st.stepId}
                      </span>
                      <span
                        className="text-[11px] font-mono ml-2 shrink-0"
                        style={{ color: stepColor(st.status) }}
                      >
                        {st.durationMs != null
                          ? `${st.durationMs}ms`
                          : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idle State */}
      {traceState.status === "idle" && (
        <div
          className="rounded-xl p-8 flex flex-col items-center justify-center text-center"
          style={{
            background: "oklch(0.12 0.005 260 / 40%)",
            border: "1px dashed oklch(1 0 0 / 12%)",
          }}
          data-testid="trace-idle-state"
        >
          <Activity
            className="h-10 w-10 mb-3"
            style={{ color: MUTED, opacity: 0.4 }}
          />
          <p className="text-sm" style={{ color: MUTED }}>
            Enter a hostname, device ID, or service row key and click{" "}
            <strong style={{ color: GOLD }}>Run Trace</strong> to begin.
          </p>
          <p className="text-xs mt-2" style={{ color: MUTED, opacity: 0.6 }}>
            The trace will query all ExtraHop data sources for the selected
            device and time window.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StepRailItem({
  stepId,
  label,
  index,
  snapshot,
  serial,
}: {
  stepId: TraceStepId;
  label: string;
  index: number;
  snapshot: TraceStepSnapshot;
  serial: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
      style={{
        background:
          snapshot.status === "running"
            ? "oklch(0.769 0.108 85.805 / 8%)"
            : "transparent",
      }}
      data-testid={`trace-step-${stepId}`}
      data-step-status={snapshot.status}
    >
      {/* Step number */}
      <span
        className="text-[10px] font-mono w-5 text-center shrink-0"
        style={{ color: stepColor(snapshot.status) }}
      >
        {index + 1}
      </span>

      {/* Status icon */}
      <StepIcon status={snapshot.status} size={16} />

      {/* Label and detail */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium"
            style={{ color: snapshot.status === "idle" ? MUTED : BRIGHT }}
          >
            {label}
          </span>
          {!serial && snapshot.status !== "idle" && (
            <span
              className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{
                background: "oklch(0.75 0.15 195 / 15%)",
                color: CYAN,
              }}
            >
              parallel
            </span>
          )}
        </div>
        {snapshot.detail && (
          <p
            className="text-xs truncate mt-0.5"
            style={{ color: MUTED }}
          >
            {snapshot.detail}
          </p>
        )}
      </div>

      {/* Duration */}
      {snapshot.durationMs != null && (
        <span
          className="text-xs font-mono shrink-0"
          style={{ color: stepColor(snapshot.status) }}
          data-testid={`step-duration-${stepId}`}
        >
          {snapshot.durationMs}ms
        </span>
      )}

      {/* Count badge */}
      {snapshot.count != null && snapshot.count > 0 && (
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: "oklch(0.769 0.108 85.805 / 15%)",
            color: GOLD,
          }}
          data-testid={`step-count-${stepId}`}
        >
          {snapshot.count}
        </span>
      )}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="text-center">
      <p
        className="text-lg font-semibold font-mono"
        style={{ color: value > 0 ? BRIGHT : MUTED }}
      >
        {value.toLocaleString()}
      </p>
      <p
        className="text-[10px] uppercase tracking-wider"
        style={{ color: MUTED }}
      >
        {label}
      </p>
    </div>
  );
}
