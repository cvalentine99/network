/**
 * Appliance Settings Page — Slice 14
 *
 * Configuration form for ExtraHop appliance connection:
 *   - Hostname (FQDN or IP)
 *   - API Key (masked display, full entry)
 *   - Verify SSL toggle
 *   - Cloud Services toggle
 *   - Nickname (optional label)
 *   - Test Connection button
 *   - Save / Delete actions
 *
 * CONTRACT:
 *   - All data flows through tRPC (trpc.applianceConfig.*)
 *   - API key is NEVER displayed in full — only apiKeyHint from the BFF
 *   - Form validation uses ApplianceConfigInputSchema (shared Zod)
 *   - 5 UI states: loading, quiet (no config), populated (config exists), saving, testing
 *   - Delete resets to quiet state
 *   - Test Connection calls the BFF which attempts a real HTTP/HTTPS call to the appliance
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { GlassCard, PageHeader, GOLD, MUTED, BRIGHT, GREEN, RED, AMBER, CYAN } from '@/components/DashboardWidgets';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  Server,
  Key,
  Shield,
  ShieldOff,
  Cloud,
  CloudOff,
  Tag,
  Wifi,
  WifiOff,
  Save,
  Trash2,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';

// ─── Status badge for test result ────────────────────────────────────────
function TestResultBadge({ result, message }: { result: string; message: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    success: { color: GREEN, icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Connected' },
    failure: { color: RED, icon: <XCircle className="w-3.5 h-3.5" />, label: 'Failed' },
    untested: { color: MUTED, icon: <Clock className="w-3.5 h-3.5" />, label: 'Untested' },
  };
  const c = config[result] ?? config.untested;

  return (
    <div className="flex items-center gap-2" data-testid="test-result-badge">
      <span style={{ color: c.color }}>{c.icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.color }}>
          {c.label}
        </span>
        {message && (
          <span className="text-[10px] font-mono" style={{ color: MUTED }}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Form field wrapper ──────────────────────────────────────────────────
function Field({
  label,
  icon,
  children,
  error,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2">
        <span style={{ color: GOLD }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
          {label}
        </span>
      </label>
      {children}
      {error && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: RED }}>
          <AlertTriangle className="w-3 h-3" />
          {error}
        </span>
      )}
      {hint && !error && (
        <span className="text-[10px]" style={{ color: MUTED }}>
          {hint}
        </span>
      )}
    </div>
  );
}

// ─── Text input styled for dark theme ────────────────────────────────────
function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  testId,
  rightElement,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  testId?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        className="w-full rounded-lg px-3 py-2.5 text-[12px] font-mono transition-colors focus:outline-none focus:ring-1 disabled:opacity-50"
        style={{
          background: 'oklch(0.08 0.005 260)',
          border: '1px solid oklch(1 0 0 / 10%)',
          color: BRIGHT,
          fontFamily: 'var(--font-mono)',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = GOLD;
          e.target.style.boxShadow = `0 0 0 1px ${GOLD}40`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'oklch(1 0 0 / 10%)';
          e.target.style.boxShadow = 'none';
        }}
      />
      {rightElement && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  );
}

// ─── Toggle switch ───────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      data-testid={testId}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50"
      style={{
        background: checked ? `${GREEN}60` : 'oklch(0.15 0.005 260)',
        border: `1px solid ${checked ? GREEN : 'oklch(1 0 0 / 10%)'}`,
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full transition-transform"
        style={{
          background: checked ? GREEN : MUTED,
          transform: checked ? 'translateX(22px)' : 'translateX(3px)',
        }}
      />
    </button>
  );
}

// ─── Action button ───────────────────────────────────────────────────────
function ActionButton({
  onClick,
  disabled,
  loading,
  icon,
  label,
  variant = 'primary',
  testId,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'danger' | 'secondary';
  testId?: string;
}) {
  const colors = {
    primary: { bg: `${GOLD}20`, border: `${GOLD}40`, text: GOLD },
    danger: { bg: `${RED}20`, border: `${RED}40`, text: RED },
    secondary: { bg: 'oklch(0.15 0.005 260)', border: 'oklch(1 0 0 / 10%)', text: CYAN },
  };
  const c = colors[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={testId}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function ApplianceSettings() {
  const configQuery = trpc.applianceConfig.get.useQuery();
  const saveMutation = trpc.applianceConfig.save.useMutation();
  const testMutation = trpc.applianceConfig.testConnection.useMutation();
  const deleteMutation = trpc.applianceConfig.delete.useMutation();
  const utils = trpc.useUtils();

  // Form state
  const [hostname, setHostname] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [verifySsl, setVerifySsl] = useState(true);
  const [cloudServicesEnabled, setCloudServicesEnabled] = useState(false);
  const [nickname, setNickname] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Populate form when config loads
  useEffect(() => {
    if (configQuery.data) {
      setHostname(configQuery.data.hostname);
      setApiKey(''); // Never pre-fill API key
      setVerifySsl(configQuery.data.verifySsl);
      setCloudServicesEnabled(configQuery.data.cloudServicesEnabled);
      setNickname(configQuery.data.nickname);
      setHasUnsavedChanges(false);
    }
  }, [configQuery.data]);

  // Track unsaved changes
  const markDirty = () => setHasUnsavedChanges(true);

  // Validate form
  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!hostname.trim()) errors.hostname = 'Hostname is required';
    else if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/.test(hostname.trim())) {
      errors.hostname = 'Invalid hostname format — use FQDN, IPv4, or short hostname';
    }
    // API key is required only for new configs (no existing config) or when user enters one
    if (!configQuery.data && !apiKey.trim()) {
      errors.apiKey = 'API key is required for initial configuration';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Save handler
  async function handleSave() {
    if (!validate()) return;
    try {
      await saveMutation.mutateAsync({
        hostname: hostname.trim(),
        apiKey: apiKey.trim() || (configQuery.data ? '___KEEP_EXISTING___' : ''),
        verifySsl,
        cloudServicesEnabled,
        nickname: nickname.trim(),
      });
      setApiKey('');
      setHasUnsavedChanges(false);
      setFormErrors({});
      utils.applianceConfig.get.invalidate();
    } catch (err: any) {
      setFormErrors({ _save: err.message || 'Failed to save configuration' });
    }
  }

  // Test connection handler
  async function handleTest() {
    try {
      await testMutation.mutateAsync();
      utils.applianceConfig.get.invalidate();
    } catch {
      // Error is captured in testMutation.data
    }
  }

  // Delete handler
  async function handleDelete() {
    if (!configQuery.data) return;
    try {
      await deleteMutation.mutateAsync({ id: configQuery.data.id });
      setHostname('');
      setApiKey('');
      setVerifySsl(true);
      setCloudServicesEnabled(false);
      setNickname('');
      setHasUnsavedChanges(false);
      setFormErrors({});
      utils.applianceConfig.get.invalidate();
    } catch (err: any) {
      setFormErrors({ _delete: err.message || 'Failed to delete configuration' });
    }
  }

  // Loading state
  if (configQuery.isLoading) {
    return (
      <div data-testid="settings-loading">
        <PageHeader title="Appliance Settings" subtitle="ExtraHop connection configuration" />
        <div className="mt-6">
          <GlassCard>
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-48 rounded bg-white/5" />
              <div className="h-10 rounded bg-white/5" />
              <div className="h-4 w-48 rounded bg-white/5" />
              <div className="h-10 rounded bg-white/5" />
              <div className="h-4 w-32 rounded bg-white/5" />
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // Error state (transport failure)
  if (configQuery.isError) {
    return (
      <div data-testid="settings-error">
        <PageHeader title="Appliance Settings" subtitle="ExtraHop connection configuration" />
        <div className="mt-6">
          <ErrorState
            type="transport"
            title="Settings unavailable"
            message={configQuery.error?.message || 'Failed to load appliance configuration'}
          />
        </div>
      </div>
    );
  }

  const existingConfig = configQuery.data;
  const isConfigured = !!existingConfig;

  return (
    <div data-testid="settings-page">
      <PageHeader title="Appliance Settings" subtitle="ExtraHop connection configuration" />

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Configuration form (2/3 width on xl) */}
        <div className="xl:col-span-2 space-y-6">
          <GlassCard>
            <div className="flex items-center gap-2 mb-6">
              <Server className="w-4 h-4" style={{ color: GOLD }} />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: BRIGHT }}>
                Connection Configuration
              </h2>
              {hasUnsavedChanges && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: `${AMBER}20`, color: AMBER }}
                >
                  Unsaved Changes
                </span>
              )}
            </div>

            <div className="space-y-5">
              {/* Hostname */}
              <Field
                label="Hostname / IP Address"
                icon={<Server className="w-3.5 h-3.5" />}
                error={formErrors.hostname}
                hint="FQDN (eda01.lab.local), IPv4 (10.0.0.1), or short hostname (eda01)"
              >
                <TextInput
                  value={hostname}
                  onChange={(v) => { setHostname(v); markDirty(); }}
                  placeholder="eda01.lab.local"
                  testId="input-hostname"
                />
              </Field>

              {/* API Key */}
              <Field
                label="API Key"
                icon={<Key className="w-3.5 h-3.5" />}
                error={formErrors.apiKey}
                hint={
                  isConfigured
                    ? `Current key: ${existingConfig.apiKeyHint} — leave blank to keep existing`
                    : 'ExtraHop REST API key (Settings → API Access → Generate)'
                }
              >
                <TextInput
                  value={apiKey}
                  onChange={(v) => { setApiKey(v); markDirty(); }}
                  placeholder={isConfigured ? '••••••••' : 'Enter API key'}
                  type={showApiKey ? 'text' : 'password'}
                  testId="input-apikey"
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1 rounded hover:bg-white/5 transition-colors"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-3.5 h-3.5" style={{ color: MUTED }} />
                      ) : (
                        <Eye className="w-3.5 h-3.5" style={{ color: MUTED }} />
                      )}
                    </button>
                  }
                />
              </Field>

              {/* Nickname */}
              <Field
                label="Nickname (optional)"
                icon={<Tag className="w-3.5 h-3.5" />}
                hint="Friendly label for this appliance (e.g., 'Lab EDA', 'Production Sensor')"
              >
                <TextInput
                  value={nickname}
                  onChange={(v) => { setNickname(v); markDirty(); }}
                  placeholder="Lab EDA"
                  testId="input-nickname"
                />
              </Field>

              {/* Toggles row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="Verify SSL Certificate"
                  icon={verifySsl ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                   hint="When disabled: connects via HTTP (plain). When enabled: connects via HTTPS with certificate verification."
                >
                  <Toggle
                    checked={verifySsl}
                    onChange={(v) => { setVerifySsl(v); markDirty(); }}
                    testId="toggle-verify-ssl"
                  />
                </Field>

                <Field
                  label="Cloud Services"
                  icon={cloudServicesEnabled ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
                  hint="Enable if appliance uses ExtraHop Cloud Services (Reveal(x) 360)"
                >
                  <Toggle
                    checked={cloudServicesEnabled}
                    onChange={(v) => { setCloudServicesEnabled(v); markDirty(); }}
                    testId="toggle-cloud-services"
                  />
                </Field>
              </div>

              {/* Global form errors */}
              {formErrors._save && (
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: `${RED}15`, border: `1px solid ${RED}30` }}>
                  <XCircle className="w-4 h-4 shrink-0" style={{ color: RED }} />
                  <span className="text-[11px]" style={{ color: RED }}>{formErrors._save}</span>
                </div>
              )}
              {formErrors._delete && (
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: `${RED}15`, border: `1px solid ${RED}30` }}>
                  <XCircle className="w-4 h-4 shrink-0" style={{ color: RED }} />
                  <span className="text-[11px]" style={{ color: RED }}>{formErrors._delete}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <ActionButton
                  onClick={handleSave}
                  loading={saveMutation.isPending}
                  icon={<Save className="w-3.5 h-3.5" />}
                  label={isConfigured ? 'Update Configuration' : 'Save Configuration'}
                  testId="btn-save"
                />
                {isConfigured && (
                  <>
                    <ActionButton
                      onClick={handleTest}
                      loading={testMutation.isPending}
                      icon={<Zap className="w-3.5 h-3.5" />}
                      label="Test Connection"
                      variant="secondary"
                      testId="btn-test"
                    />
                    <ActionButton
                      onClick={handleDelete}
                      loading={deleteMutation.isPending}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      label="Delete"
                      variant="danger"
                      testId="btn-delete"
                    />
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right column: Status panel (1/3 width on xl) */}
        <div className="space-y-6">
          {/* Connection Status Card */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              {isConfigured ? (
                <Wifi className="w-4 h-4" style={{ color: existingConfig.lastTestResult === 'success' ? GREEN : existingConfig.lastTestResult === 'failure' ? RED : MUTED }} />
              ) : (
                <WifiOff className="w-4 h-4" style={{ color: MUTED }} />
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                Connection Status
              </h3>
            </div>

            {!isConfigured ? (
              <div data-testid="status-not-configured">
                <EmptyState
                  icon={<WifiOff className="w-8 h-8" style={{ color: MUTED }} />}
                  title="Not Configured"
                  message="Enter your ExtraHop appliance hostname and API key to establish a connection."
                />
              </div>
            ) : (
              <div className="space-y-4" data-testid="status-configured">
                {/* Test result */}
                <TestResultBadge
                  result={existingConfig.lastTestResult}
                  message={existingConfig.lastTestMessage}
                />

                {/* Config summary */}
                <div className="space-y-2 pt-2" style={{ borderTop: '1px solid oklch(1 0 0 / 6%)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Host</span>
                    <span className="text-[11px] font-mono" style={{ color: BRIGHT }}>{existingConfig.hostname}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>API Key</span>
                    <span className="text-[11px] font-mono" style={{ color: BRIGHT }}>{existingConfig.apiKeyHint}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>SSL Verify</span>
                    <span className="text-[11px]" style={{ color: existingConfig.verifySsl ? GREEN : AMBER }}>
                      {existingConfig.verifySsl ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Cloud</span>
                    <span className="text-[11px]" style={{ color: existingConfig.cloudServicesEnabled ? CYAN : MUTED }}>
                      {existingConfig.cloudServicesEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {existingConfig.nickname && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Nickname</span>
                      <span className="text-[11px]" style={{ color: GOLD }}>{existingConfig.nickname}</span>
                    </div>
                  )}
                  {existingConfig.lastTestedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Last Tested</span>
                      <span className="text-[11px] font-mono" style={{ color: MUTED }}>
                        {new Date(existingConfig.lastTestedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </GlassCard>

          {/* Test Connection Result Card (shown after test) */}
          {testMutation.data && (
            <GlassCard>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" style={{ color: testMutation.data.success ? GREEN : RED }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                  Test Result
                </h3>
              </div>
              <div className="space-y-2" data-testid="test-result-card">
                <div className="flex items-center gap-2">
                  {testMutation.data.success ? (
                    <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} />
                  ) : (
                    <XCircle className="w-4 h-4" style={{ color: RED }} />
                  )}
                  <span className="text-[11px] font-medium" style={{ color: testMutation.data.success ? GREEN : RED }}>
                    {testMutation.data.message}
                  </span>
                </div>
                {testMutation.data.latencyMs !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Latency</span>
                    <span className="text-[11px] font-mono tabular-nums" style={{ color: BRIGHT }}>
                      {testMutation.data.latencyMs}ms
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Tested At</span>
                  <span className="text-[11px] font-mono" style={{ color: MUTED }}>
                    {new Date(testMutation.data.testedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
