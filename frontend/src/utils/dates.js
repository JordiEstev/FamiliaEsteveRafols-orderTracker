// Utilitats de data en català. Compartides pel selector de data tipus roda.

export const MESOS_CA = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol',
  'agost', 'setembre', 'octubre', 'novembre', 'desembre'];

export const DIES_CA = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous',
  'divendres', 'dissabte']; // getDay(): 0=diumenge

export const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);

// Diferència en dies sencers entre dues dates "YYYY-MM-DD", normalitzant
// ambdues a mitjanit (hora local) abans de restar.
export function diaDiff(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}
