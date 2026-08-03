import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { community } from '../api/community';
import { AlertType } from '../api/nws';
import { BackHeader, Card, SectionLabel } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useAuth } from '../state/AuthContext';
import { colors, fonts } from '../theme';

const POST_TYPES: { label: string; type: AlertType; event: string }[] = [
  { label: 'Missing person', type: 'amber', event: 'Missing Person' },
  { label: 'Flooding', type: 'flood', event: 'Flood Report' },
  { label: 'Fire', type: 'weather', event: 'Fire Report' },
  { label: 'Accident', type: 'weather', event: 'Accident Report' },
  { label: 'Other danger', type: 'weather', event: 'Community Alert' },
];

// Community post — the "+" on the home screen. Publishes to the shared
// backend so everyone nearby sees it in their feed within a poll cycle.
export default function PostAlertScreen({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const auth = useAuth();
  const [typeIdx, setTypeIdx] = useState(0);
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'idle' | 'posting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (state !== 'idle') return;
    if (!headline.trim()) {
      setError('Add a short headline so people know what happened.');
      return;
    }
    setError(null);
    setState('posting');
    const chosen = POST_TYPES[typeIdx];
    await community.publishAlert({
      source: 'community',
      type: chosen.type,
      event: chosen.event,
      headline: headline.trim(),
      description: description.trim() || headline.trim(),
      severity: 'Moderate',
      areaDesc: app.locationLabel,
      lat: app.center.lat,
      lon: app.center.lon,
      author: auth.user?.name ?? 'Anonymous',
    });
    setState('done');
    setTimeout(onBack, 900);
  };

  return (
    <View style={styles.screen}>
      <BackHeader title="Report to community" subtitle={`Posting near ${app.locationLabel}`} onBack={onBack} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <SectionLabel>What's happening?</SectionLabel>
          <View style={styles.chipRow}>
            {POST_TYPES.map((p, i) => (
              <Pressable key={p.label} style={[styles.chip, typeIdx === i && styles.chipActive]} onPress={() => setTypeIdx(i)}>
                <Text style={[styles.chipText, typeIdx === i && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={headline}
            onChangeText={setHeadline}
            placeholder="Headline — e.g. Child missing near Ayeduase gate"
            placeholderTextColor={colors.faint}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description — what they look like, direction, what to watch for…"
            placeholderTextColor={colors.faint}
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.submit, state === 'done' && styles.submitDone]} onPress={submit}>
            <Text style={styles.submitText}>
              {state === 'done' ? 'Posted ✓' : state === 'posting' ? 'Posting…' : 'Post alert'}
            </Text>
          </Pressable>
          <Text style={styles.footnote}>
            Posts appear in everyone's feed and on the map. If this is a life-threatening emergency, call 911 /
            112 first.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 10 },
  card: { padding: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.amberBg, borderColor: colors.amberDot },
  chipText: { fontFamily: fonts.sans500, fontSize: 12, color: colors.bodySoft },
  chipTextActive: { fontFamily: fonts.sans600, color: colors.amberDeep },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    fontFamily: fonts.sans400,
    fontSize: 13.5,
    color: colors.ink,
    marginBottom: 8,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  error: { fontFamily: fonts.sans500, fontSize: 12, color: colors.sos, marginBottom: 6 },
  submit: {
    paddingVertical: 15,
    backgroundColor: colors.primary,
    borderRadius: 13,
    alignItems: 'center',
  },
  submitDone: { backgroundColor: colors.safe },
  submitText: { fontFamily: fonts.sora700, fontSize: 15, color: '#fff' },
  footnote: { fontFamily: fonts.sans400, fontSize: 11.5, lineHeight: 16, color: colors.faint, marginTop: 10 },
});
