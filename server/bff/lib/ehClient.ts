// server/bff/lib/ehClient.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { bffConfig } from '../config';
import type { ApplianceIdentity } from '../../../shared/impact-types';

const ehClient: AxiosInstance = axios.create({
  baseURL: bffConfig.EH_HOST,
  timeout: bffConfig.EH_TIMEOUT_MS,
  headers: {
    'Authorization': `ExtraHop apikey=${bffConfig.EH_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: bffConfig.EH_VERIFY_SSL,
  }),
});

// Request/Response Timing Interceptor
ehClient.interceptors.request.use((reqConfig) => {
  (reqConfig as any)._startTime = Date.now();
  if (bffConfig.LOG_LEVEL === 'debug' || bffConfig.LOG_LEVEL === 'trace') {
    console.log(`[EH] ${reqConfig.method?.toUpperCase()} ${reqConfig.url}`);
  }
  return reqConfig;
});

ehClient.interceptors.response.use(
  (response) => {
    const elapsed = Date.now() - (response.config as any)._startTime;
    if (bffConfig.LOG_LEVEL === 'debug' || bffConfig.LOG_LEVEL === 'trace') {
      console.log(`[EH] ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status} (${elapsed}ms)`);
    }
    return response;
  },
  (error: AxiosError) => {
    const elapsed = Date.now() - ((error.config as any)?._startTime || Date.now());
    console.error(`[EH] FAIL ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status || 'NETWORK'} (${elapsed}ms): ${error.message}`);
    throw error;
  }
);

// ─── Appliance Identity (cached at startup) ───────────────────────────────
let _applianceIdentity: ApplianceIdentity | null = null;
let _licensedModuleSet: Set<string> = new Set();

export async function initApplianceIdentity(): Promise<ApplianceIdentity> {
  const [versionRes, editionRes, platformRes, licenseRes, networkRes, processRes, servicesRes] =
    await Promise.all([
      ehClient.get('/api/v1/extrahop/version'),
      ehClient.get('/api/v1/extrahop/edition'),
      ehClient.get('/api/v1/extrahop/platform'),
      ehClient.get('/api/v1/license'),
      ehClient.get('/api/v1/networks/0'),
      ehClient.get('/api/v1/extrahop/processes').catch(() => ({ data: [] })),
      ehClient.get('/api/v1/extrahop/services').catch(() => ({ data: {} })),
    ]);

  // Handle polymorphic module format
  const rawModules = licenseRes.data.modules || [];
  const rawOptions = licenseRes.data.options || [];

  let moduleNames: string[];
  if (Array.isArray(rawModules)) {
    moduleNames = rawModules.map((m: any) =>
      typeof m === 'string' ? m : m.name
    ).filter(Boolean);
  } else if (typeof rawModules === 'object' && rawModules !== null) {
    moduleNames = Object.keys(rawModules).filter(k => rawModules[k]);
  } else {
    moduleNames = [];
  }
  _licensedModuleSet = new Set(moduleNames);

  let optionNames: string[];
  if (Array.isArray(rawOptions)) {
    optionNames = rawOptions.map((o: any) =>
      typeof o === 'string' ? o : o.name
    ).filter(Boolean);
  } else {
    optionNames = [];
  }

  const networkName: string = networkRes.data?.name || 'Unknown';
  const captureMac = networkName.replace(/^Capture\s+/, '');
  const extrahopBase = await ehClient.get('/api/v1/extrahop');

  _applianceIdentity = {
    version: versionRes.data.version,
    edition: editionRes.data.edition,
    platform: platformRes.data.platform,
    hostname: extrahopBase.data.hostname || '',
    mgmtIpaddr: extrahopBase.data.mgmt_ipaddr || '',
    displayHost: extrahopBase.data.display_host || '',
    captureName: networkName,
    captureMac,
    licensedModules: moduleNames,
    licensedOptions: optionNames,
    processCount: Array.isArray(processRes.data) ? processRes.data.length : 0,
    services: servicesRes.data || {},
  };

  return _applianceIdentity;
}

export function getApplianceIdentity(): ApplianceIdentity {
  if (!_applianceIdentity) throw new Error('Appliance identity not initialized. Call initApplianceIdentity first.');
  return _applianceIdentity;
}

export function isModuleLicensed(moduleName: string): boolean {
  return _licensedModuleSet.has(moduleName);
}

export { ehClient };
