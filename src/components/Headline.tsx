// Big title with one accent-colored word, OxeAI-style. Wrap the accent word in {braces}:
//   <Headline text="Guidance That {Adapts} to Real Life" />
import { Text } from 'react-native';
import { c, t } from '@/lib/theme';

export function Headline({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/(\{[^}]+\})/g).filter(Boolean);
  return (
    <Text style={[t.hero, style]}>
      {parts.map((p, i) =>
        p.startsWith('{') && p.endsWith('}') ? (
          <Text key={i} style={{ color: c.accent }}>{p.slice(1, -1)}</Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}
