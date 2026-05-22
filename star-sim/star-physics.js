export const PRESETS = {
  sun:        { mass: 1,    age: 4.6,  hydrogen: 75, name: '☀️ Sol' },
  betelgeuse: { mass: 16.5, age: 0.008, hydrogen: 15, name: '🔴 Betelgeuse' },
  siriusA:    { mass: 2.1,  age: 0.24, hydrogen: 92, name: '💙 Sirio A' },
  proxima:    { mass: 0.12, age: 4.9,  hydrogen: 88, name: '🔵 Próxima Centauri' },
};

export const FATE_LABELS = {
  stable:      '⚖️ Estable',
  brownDwarf:  '🟤 Enana Café',
  whiteDwarf:  '⚪ Enana Blanca',
  supernova:   '💥 Supernova → Estrella de Neutrones',
  neutronStar: '💙 Estrella de Neutrones',
  blackHole:   '⚫ Agujero Negro (vía Hipernova)',
};

export function compute(mass, ageGyr, hydrogenPct) {
  const m = Math.max(0.001, mass);
  const mainLifetimeYr = 10e9 * Math.pow(m, -2.5);
  const lifeFraction   = Math.min((ageGyr * 1e9) / mainLifetimeYr, 1);
  const hRemaining     = Math.max(0, hydrogenPct * (1 - lifeFraction));

  const temperature = Math.round(5778 * Math.pow(m, 0.505));
  const luminosity  = Math.pow(m, 4);
  const radius      = Math.pow(m, 0.8);
  const lifeLeftGyr = Math.max(0, (mainLifetimeYr * (1 - lifeFraction)) / 1e9);

  const zone = getZone(hRemaining, lifeFraction, m);
  const fate = getFate(m, zone);

  return { temperature, luminosity, radius, hRemaining, lifeFraction, lifeLeftGyr, zone, fate };
}

export function getZone(hRemaining, lifeFraction, mass) {
  if (mass < 0.08) return 'red';
  if (hRemaining < 5 || lifeFraction > 0.9) return 'red';
  if (hRemaining < 20 || lifeFraction > 0.7) return 'orange';
  return 'green';
}

export function getFate(mass, zone) {
  if (mass < 0.08) return 'brownDwarf';
  if (zone === 'green' || zone === 'orange') return 'stable';
  if (mass < 8)  return 'whiteDwarf';
  if (mass < 20) return 'supernova';   // Supernova → estrella de neutrones
  return 'blackHole';                  // Hipernova → agujero negro
}

export function starColor(temperature) {
  const t = Math.log10(Math.max(temperature, 1000));
  const lo = Math.log10(2000), hi = Math.log10(50000);
  const n = Math.max(0, Math.min(1, (t - lo) / (hi - lo)));

  if (n < 0.25) return lerpColor([1.0,0.18,0.02], [1.0,0.55,0.10], n/0.25);
  if (n < 0.45) return lerpColor([1.0,0.55,0.10], [1.0,0.90,0.30], (n-0.25)/0.20);
  if (n < 0.60) return lerpColor([1.0,0.90,0.30], [1.0,1.00,0.80], (n-0.45)/0.15);
  if (n < 0.78) return lerpColor([1.0,1.00,0.80], [0.82,0.90,1.0], (n-0.60)/0.18);
  return lerpColor([0.82,0.90,1.0], [0.50,0.65,1.0], (n-0.78)/0.22);
}

function lerpColor(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

export function formatLife(gyr) {
  if (gyr <= 0) return 'Agotada';
  if (gyr < 0.001) return '< 1 Myr';
  if (gyr < 1) return `${(gyr*1000).toFixed(0)} Myr`;
  return `~${gyr.toFixed(1)} Gyr`;
}

export function formatTemp(k) {
  return k.toLocaleString('es-MX') + ' K';
}

export function formatLum(l) {
  if (l >= 1e6) return `${(l/1e6).toFixed(1)}M L☉`;
  if (l >= 1000) return `${(l/1000).toFixed(1)}k L☉`;
  if (l < 0.001) return `${(l*1000).toFixed(3)}m L☉`;
  return `${l.toFixed(3)} L☉`;
}

export function formatRad(r) {
  if (r >= 1000) return `${(r/1000).toFixed(1)}k R☉`;
  return `${r.toFixed(2)} R☉`;
}

// Zone threshold percentages on the Mass slider (for CSS gradient)
export function zoneThresholds(mass, hydrogenPct) {
  // For the mass slider (0.08-150), compute where orange and red start
  // Simplified: based solely on mass boundaries since H% slider is separate
  const orangeStart = 0.08 / 150;   // brown dwarf starts right at 0.08
  const redStart = 20 / 150;         // > 20 M☉ → black hole fate (more extreme)
  return { orangePct: (8/150)*100, redPct: (20/150)*100 };
}
