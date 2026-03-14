/**
 * Slice 24 — Help Page
 *
 * Glossary, keyboard shortcuts, surface descriptions,
 * and fixture-mode vs live-integration explanation.
 */

import { useState, useMemo } from 'react';
import {
  HelpCircle, BookOpen, Keyboard, Layout, Info,
  Search, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import {
  GLOSSARY, KEYBOARD_SHORTCUTS, SURFACE_DESCRIPTIONS,
  INTEGRATION_STATUS_LABELS, INTEGRATION_STATUS_COLORS,
  type GlossaryEntry, type KeyboardShortcut, type SurfaceDescription,
} from '../../../shared/help-types';

// ─── Colors ──────────────────────────────────────────────────────────────

const GOLD = 'oklch(0.769 0.108 85.805)';
const CYAN = 'oklch(0.75 0.15 195)';
const GREEN = 'oklch(0.723 0.219 149.579)';
const MUTED = 'oklch(0.6 0.01 260)';
const BRIGHT = 'oklch(0.95 0.005 85)';
const GLASS_BG = 'oklch(0.15 0.005 260 / 60%)';
const GLASS_BORDER = 'oklch(1 0 0 / 8%)';

// ─── Section Header ──────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color }: { icon: any; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon className="h-5 w-5" style={{ color }} />
      <h2 className="text-lg font-semibold tracking-tight" style={{ color: BRIGHT }}>{title}</h2>
    </div>
  );
}

// ─── Glossary Section ────────────────────────────────────────────────────

function GlossarySection({ searchTerm }: { searchTerm: string }) {
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchTerm) return GLOSSARY;
    const lower = searchTerm.toLowerCase();
    return GLOSSARY.filter(
      e => e.term.toLowerCase().includes(lower) || e.definition.toLowerCase().includes(lower)
    );
  }, [searchTerm]);

  if (filtered.length === 0) {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
        data-testid="glossary-empty"
      >
        <p className="text-sm" style={{ color: MUTED }}>No glossary entries match "{searchTerm}"</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg divide-y"
      style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
      data-testid="glossary-list"
    >
      {filtered.map((entry: GlossaryEntry) => {
        const isExpanded = expandedTerm === entry.term;
        return (
          <div key={entry.term}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedTerm(isExpanded ? null : entry.term)}
              data-testid={`glossary-term-${entry.term.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span className="text-sm font-medium" style={{ color: BRIGHT }}>{entry.term}</span>
              <div className="flex items-center gap-2">
                {entry.surface && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'oklch(1 0 0 / 5%)', color: CYAN }}>
                    {entry.surface}
                  </span>
                )}
                {isExpanded ? <ChevronUp className="h-3 w-3" style={{ color: MUTED }} /> : <ChevronDown className="h-3 w-3" style={{ color: MUTED }} />}
              </div>
            </button>
            {isExpanded && (
              <div className="px-4 pb-3 space-y-2">
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{entry.definition}</p>
                {entry.seeAlso && entry.seeAlso.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-medium" style={{ color: MUTED }}>See also:</span>
                    {entry.seeAlso.map(ref => (
                      <button
                        key={ref}
                        className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/[0.05] transition-colors"
                        style={{ background: 'oklch(1 0 0 / 5%)', color: GOLD }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTerm(ref);
                        }}
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Keyboard Shortcuts Section ──────────────────────────────────────────

function KeyboardShortcutsSection() {
  const grouped = useMemo(() => {
    const map = new Map<string, KeyboardShortcut[]>();
    for (const sc of KEYBOARD_SHORTCUTS) {
      const existing = map.get(sc.scope) || [];
      existing.push(sc);
      map.set(sc.scope, existing);
    }
    return map;
  }, []);

  return (
    <div className="space-y-4" data-testid="keyboard-shortcuts">
      {Array.from(grouped.entries()).map(([scope, shortcuts]) => (
        <div key={scope}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: MUTED }}>{scope}</p>
          <div
            className="rounded-lg divide-y"
            style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
          >
            {shortcuts.map((sc, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm" style={{ color: BRIGHT }}>{sc.action}</span>
                <div className="flex items-center gap-1">
                  {sc.keys.map((key, ki) => (
                    <span key={ki}>
                      <kbd
                        className="text-[11px] font-mono px-2 py-1 rounded"
                        style={{
                          background: 'oklch(0.2 0.005 260)',
                          border: '1px solid oklch(1 0 0 / 12%)',
                          color: GOLD,
                          boxShadow: '0 1px 2px oklch(0 0 0 / 30%)',
                        }}
                      >
                        {key}
                      </kbd>
                      {ki < sc.keys.length - 1 && <span className="text-[10px] mx-0.5" style={{ color: MUTED }}>+</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Surfaces Section ────────────────────────────────────────────────────

function SurfacesSection() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-3" data-testid="surface-descriptions">
      {SURFACE_DESCRIPTIONS.map((surface: SurfaceDescription) => {
        const statusColor = INTEGRATION_STATUS_COLORS[surface.integrationStatus];
        const statusLabel = INTEGRATION_STATUS_LABELS[surface.integrationStatus];
        return (
          <div
            key={surface.path}
            className="rounded-lg p-4"
            style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
            data-testid={`surface-${surface.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: BRIGHT }}>{surface.name}</h3>
                <p className="text-xs italic mt-0.5" style={{ color: GOLD }}>"{surface.question}"</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: `color-mix(in oklch, ${statusColor} 15%, transparent)`, color: statusColor, border: `1px solid color-mix(in oklch, ${statusColor} 30%, transparent)` }}
                >
                  {surface.integrationStatus.replace('-', ' ')}
                </span>
                {surface.path !== '/help' && (
                  <button
                    className="p-1 rounded hover:bg-white/[0.05] transition-colors"
                    onClick={() => setLocation(surface.path)}
                    title={`Go to ${surface.name}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" style={{ color: CYAN }} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{surface.description}</p>
            <p className="text-[10px] mt-2" style={{ color: statusColor }}>{statusLabel}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Integration Mode Section ────────────────────────────────────────────

function IntegrationModeSection() {
  return (
    <div className="space-y-3" data-testid="integration-mode">
      <div
        className="rounded-lg p-4"
        style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded"
            style={{ background: `color-mix(in oklch, ${GREEN} 15%, transparent)`, color: GREEN, border: `1px solid color-mix(in oklch, ${GREEN} 30%, transparent)` }}
          >
            Current Mode
          </span>
          <span className="text-sm font-semibold" style={{ color: GREEN }}>Fixture Mode</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          All dashboard surfaces are currently operating against deterministic fixture data.
          Every BFF route returns pre-defined payloads that have been schema-validated and tested.
          This mode enables full UI development, testing, and contract verification without requiring
          access to a live ExtraHop appliance, packet store, or lab network.
        </p>
      </div>

      <div
        className="rounded-lg p-4"
        style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded"
            style={{ background: `color-mix(in oklch, ${MUTED} 15%, transparent)`, color: MUTED, border: `1px solid color-mix(in oklch, ${MUTED} 30%, transparent)` }}
          >
            Future Mode
          </span>
          <span className="text-sm font-semibold" style={{ color: MUTED }}>Live Integration</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          When a live ExtraHop appliance is configured via Settings, BFF routes will proxy requests
          to the appliance REST API. The browser will still never contact ExtraHop directly — all
          requests flow through the BFF layer. Shared types, validators, and normalization logic
          will remain identical; only the data source changes.
        </p>
      </div>

      <div
        className="rounded-lg p-4"
        style={{ background: 'oklch(0.769 0.108 85.805 / 8%)', border: `1px solid oklch(0.769 0.108 85.805 / 20%)` }}
      >
        <p className="text-xs font-medium" style={{ color: GOLD }}>Architectural Invariant</p>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: MUTED }}>
          The browser must not contact ExtraHop directly. All data flows through BFF routes.
          This invariant holds in both fixture mode and live integration mode.
        </p>
      </div>
    </div>
  );
}

// ─── Tab Navigation ──────────────────────────────────────────────────────

type HelpTab = 'glossary' | 'shortcuts' | 'surfaces' | 'integration';

const TABS: { id: HelpTab; label: string; icon: any }[] = [
  { id: 'glossary', label: 'Glossary', icon: BookOpen },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'surfaces', label: 'Surfaces', icon: Layout },
  { id: 'integration', label: 'Integration', icon: Info },
];

// ─── Main Component ──────────────────────────────────────────────────────

export default function Help() {
  const [activeTab, setActiveTab] = useState<HelpTab>('glossary');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6" data-testid="help-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HelpCircle className="h-6 w-6" style={{ color: GOLD }} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: BRIGHT }}>Help</h1>
          <p className="text-sm" style={{ color: MUTED }}>
            Glossary, keyboard shortcuts, surface guide, and integration status.
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ background: 'oklch(0.1 0.005 260)', border: `1px solid ${GLASS_BORDER}` }}
        data-testid="help-tabs"
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center"
              style={{
                background: isActive ? 'oklch(0.18 0.005 260)' : 'transparent',
                color: isActive ? BRIGHT : MUTED,
                border: isActive ? `1px solid ${GLASS_BORDER}` : '1px solid transparent',
              }}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`help-tab-${tab.id}`}
            >
              <tab.icon className="h-4 w-4" style={{ color: isActive ? GOLD : MUTED }} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search (glossary only) */}
      {activeTab === 'glossary' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: MUTED }} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search glossary..."
            className="pl-10 h-10"
            style={{ background: 'oklch(0.08 0.005 260)', borderColor: 'oklch(1 0 0 / 12%)' }}
            data-testid="glossary-search"
          />
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'glossary' && (
        <>
          <SectionHeader icon={BookOpen} title={`Glossary (${GLOSSARY.length} terms)`} color={GOLD} />
          <GlossarySection searchTerm={searchTerm} />
        </>
      )}

      {activeTab === 'shortcuts' && (
        <>
          <SectionHeader icon={Keyboard} title="Keyboard Shortcuts" color={CYAN} />
          <KeyboardShortcutsSection />
        </>
      )}

      {activeTab === 'surfaces' && (
        <>
          <SectionHeader icon={Layout} title={`Dashboard Surfaces (${SURFACE_DESCRIPTIONS.length})`} color={GREEN} />
          <SurfacesSection />
        </>
      )}

      {activeTab === 'integration' && (
        <>
          <SectionHeader icon={Info} title="Integration Status" color={GOLD} />
          <IntegrationModeSection />
        </>
      )}
    </div>
  );
}
