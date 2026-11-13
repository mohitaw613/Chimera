/**
 * Graph visual assets, SVG node icons, and intuitive label formatters.
 * Inspired by enterprise SOC investigation consoles (e.g. Sentinel, CrowdStrike).
 */

const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const laptopSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="4" rx="2"/><line x1="2" x2="22" y1="20" y2="20"/></svg>`;

const serverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>`;

const alertSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`;

const globeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;

const dbSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`;

export const NODE_ICONS = {
  user: `data:image/svg+xml;utf8,${encodeURIComponent(userSvg)}`,
  device: `data:image/svg+xml;utf8,${encodeURIComponent(laptopSvg)}`,
  server: `data:image/svg+xml;utf8,${encodeURIComponent(serverSvg)}`,
  service: `data:image/svg+xml;utf8,${encodeURIComponent(serverSvg)}`,
  alert: `data:image/svg+xml;utf8,${encodeURIComponent(alertSvg)}`,
  ip: `data:image/svg+xml;utf8,${encodeURIComponent(globeSvg)}`,
  external: `data:image/svg+xml;utf8,${encodeURIComponent(globeSvg)}`,
  database: `data:image/svg+xml;utf8,${encodeURIComponent(dbSvg)}`,
};

/**
 * Transforms raw telemetry entity IDs (e.g. user:user_jdoe, device:ws-207)
 * into intuitive, analyst-friendly multi-line display labels.
 */
export function formatNodeLabel(id: string, rawLabel?: string): { title: string; subtitle: string; full: string; type: string } {
  const cleanId = id.replace(/^(user:|device:|service:|event:|external:|ip:)/, '');
  const lower = id.toLowerCase();

  if (lower.startsWith('user:')) {
    const username = cleanId.replace(/^user_/, '');
    const title = username.includes('svc') ? 'Service Account' : 'Employee Account';
    return { title, subtitle: `(${username})`, full: `${title}\n(${username})`, type: 'user' };
  }

  if (lower.includes('privilege') || lower.includes('admin') || lower.startsWith('event:')) {
    return {
      title: 'Privilege Modification',
      subtitle: cleanId.startsWith('evt_') ? `(${cleanId})` : '',
      full: 'Privilege Modification',
      type: 'alert',
    };
  }

  if (lower.includes('srv-') || lower.includes('server') || lower.includes('service')) {
    return {
      title: 'Service Server',
      subtitle: `(${cleanId.toUpperCase()})`,
      full: `Service Account\n(${cleanId.toUpperCase()})`,
      type: 'service',
    };
  }

  if (lower.includes('ws-') || lower.includes('workstation') || lower.includes('device:')) {
    return {
      title: 'Workstation',
      subtitle: `(${cleanId.toUpperCase()})`,
      full: `Workstation\n(${cleanId.toUpperCase()})`,
      type: 'device',
    };
  }

  if (lower.includes('db') || lower.includes('database') || lower.includes('payroll')) {
    return {
      title: 'Database Server',
      subtitle: `(${cleanId})`,
      full: `Database\n(${cleanId})`,
      type: 'database',
    };
  }

  if (lower.startsWith('external:') || lower.startsWith('ip:') || /^\d+\.\d+\.\d+\.\d+/.test(cleanId)) {
    return {
      title: 'External IP',
      subtitle: `(${cleanId})`,
      full: `External IP\n(${cleanId})`,
      type: 'external',
    };
  }

  const title = rawLabel || cleanId;
  return { title, subtitle: '', full: title, type: 'device' };
}
