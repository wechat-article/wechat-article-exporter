import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';

let runtimeInitialized = false;
let consolePatched = false;

function patchTrialConsoleNoise() {
  if (!import.meta.client || consolePatched) return;

  const orig = console.error;
  console.error = (...args: unknown[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
    const agGridTrialNoise =
      text.includes('AG Grid Enterprise License') ||
      text.includes('License Key Not Found') ||
      text.includes('All AG Grid Enterprise features are unlocked for trial') ||
      text.includes('info@ag-grid.com for a trial license');
    const trialBannerLine = text.trim().startsWith('***') && text.trim().endsWith('***') && text.length > 30;
    if (agGridTrialNoise || trialBannerLine) {
      return;
    }
    orig.apply(console, args as Parameters<typeof console.error>);
  };

  consolePatched = true;
}

export function setupAgGridRuntime(licenseKey?: string) {
  if (!licenseKey) {
    patchTrialConsoleNoise();
  }

  if (!runtimeInitialized) {
    ModuleRegistry.registerModules([AllEnterpriseModule]);
    runtimeInitialized = true;
  }

  LicenseManager.setLicenseKey(licenseKey || '');
}
