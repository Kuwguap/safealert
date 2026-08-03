import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PlaceResult, searchPlaces } from '../api/openMeteo';
import { Card, SectionLabel } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors, fonts } from '../theme';

// Places tab — saved locations (home, work, relative's area — per proposal).
// The active place drives which area's weather + alerts the app shows.
export default function PlacesScreen() {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchSeq = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = (text: string) => {
    setQuery(text);
    setSearchError(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    // debounce — Nominatim rate-limits rapid-fire queries
    debounce.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(text.trim());
        if (seq === searchSeq.current) setResults(found);
      } catch {
        if (seq === searchSeq.current) setSearchError('Search unavailable — check your connection.');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 500);
  };

  const addResult = (r: PlaceResult) => {
    app.addPlace({ label: r.name, place: [r.name, r.region].filter(Boolean).join(', '), lat: r.lat, lon: r.lon });
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Places</Text>
        <Text style={styles.subtitle}>Get alerts for the areas your people are in</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Add a place */}
        <Card style={styles.card}>
          <SectionLabel>Add a place</SectionLabel>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={runSearch}
            placeholder="Search — Ayeduase, Adum, Tech Junction…"
            placeholderTextColor={colors.faint}
            autoCorrect={false}
          />
          {searching ? <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} /> : null}
          {searchError ? <Text style={styles.searchHint}>{searchError}</Text> : null}
          {results.map((r) => (
            <Pressable key={`${r.lat},${r.lon}`} style={styles.resultRow} onPress={() => addResult(r)}>
              <View style={styles.resultDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.name}</Text>
                <Text style={styles.rowMeta}>{r.region}</Text>
              </View>
              <Text style={styles.addLink}>Add</Text>
            </Pressable>
          ))}
        </Card>

        {/* Saved places */}
        <Card style={styles.card}>
          <SectionLabel>Saved places</SectionLabel>
          <Pressable
            style={[styles.placeRow, app.activePlaceId === null && styles.placeRowActive]}
            onPress={() => app.setActivePlace(null)}
          >
            <View style={[styles.resultDot, { backgroundColor: app.activePlaceId === null ? colors.primary : colors.inactiveIcon }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Current location</Text>
              <Text style={styles.rowMeta}>
                {app.locationSource === 'fallback' ? 'Location unavailable — using default area' : 'Follows your GPS position'}
              </Text>
            </View>
            {app.activePlaceId === null ? <Text style={styles.activeMark}>Active</Text> : null}
          </Pressable>

          {app.places.map((p) => {
            const active = p.id === app.activePlaceId;
            return (
              <View key={p.id} style={[styles.placeRow, active && styles.placeRowActive]}>
                <Pressable style={styles.placeMain} onPress={() => app.setActivePlace(p.id)}>
                  <View style={[styles.resultDot, { backgroundColor: active ? colors.primary : colors.inactiveIcon }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{p.label}</Text>
                    <Text style={styles.rowMeta}>{p.place}</Text>
                  </View>
                  {active ? <Text style={styles.activeMark}>Active</Text> : null}
                </Pressable>
                <Pressable onPress={() => app.removePlace(p.id)} hitSlop={8}>
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            );
          })}

          {app.places.length === 0 ? (
            <Text style={styles.searchHint}>No saved places yet — search above to add home, work, or a relative's area.</Text>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.sora700, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.sans400, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  body: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 10, gap: 12 },
  card: { padding: 14 },

  searchInput: {
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    fontFamily: fonts.sans400,
    fontSize: 13.5,
    color: colors.ink,
  },
  searchHint: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.faint, marginTop: 10 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    marginTop: 8,
  },
  resultDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  rowTitle: { fontFamily: fonts.sans600, fontSize: 13.5, color: colors.ink },
  rowMeta: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.muted },
  addLink: { fontFamily: fonts.sans600, fontSize: 12, color: colors.primary },

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    marginBottom: 8,
  },
  placeRowActive: { borderWidth: 1.5, borderColor: colors.primary },
  placeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  activeMark: { fontFamily: fonts.sans600, fontSize: 11.5, color: colors.primary },
  removeLink: { fontFamily: fonts.sans600, fontSize: 12, color: colors.muted },
});
