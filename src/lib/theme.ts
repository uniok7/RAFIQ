// Design tokens. Visual language borrowed from the OxeAI reference: near-black ground,
// violet accent, soft rounded cards, one accent word per headline, gradient heroes.
export const c = {
  bg: '#0B0B0F',
  bg2: '#0E0E14',
  card: '#17171F',
  cardHi: '#1E1E28',
  text: '#F5F6FA',
  dim: '#9A9AA8',
  faint: '#6B6B78',
  accent: '#6C5CE7',      // violet — selection, primary
  accentSoft: '#8B7CF0',
  line: '#24242E',
  // score/metric hues from the reference dashboards
  activity: '#F5702A',
  nutrition: '#34C759',
  calm: '#7A5CFF',
  sleep: '#8E8BE8',
  good: '#34C759',
  warn: '#E0B341',
  bad: '#E05A5A',
};

// Gradients as color tuples for expo-linear-gradient.
export const grad = {
  logo: ['#FF5FA2', '#8B5CF6', '#4CC9F0'] as const,   // rainbow "X" mark
  accent: ['#6C5CE7', '#8B5CF6'] as const,            // primary CTA
  hero: ['#0B0B0F', '#2A1D2B', '#8A5A3C'] as const,   // warm dune backdrop
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const t = {
  hero: { fontSize: 34, fontWeight: '800' as const, color: c.text, lineHeight: 40 },
  title: { fontSize: 26, fontWeight: '700' as const, color: c.text, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '600' as const, color: c.text },
  body: { fontSize: 16, color: c.text, lineHeight: 22 },
  dim: { fontSize: 15, color: c.dim, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '600' as const, color: c.dim, letterSpacing: 0.5 },
};
