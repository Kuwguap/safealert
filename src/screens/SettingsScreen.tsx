import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AlertType } from '../api/nws';
import { Card, SectionLabel } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useAuth } from '../state/AuthContext';
import { colors, fonts } from '../theme';
import { timeAgo } from '../util/geo';

const ALERT_TYPES: { key: AlertType; label: string; desc: string }[] = [
  { key: 'amber', label: 'AMBER Alerts', desc: 'Child abduction emergencies' },
  { key: 'flood', label: 'Flood alerts', desc: 'Flood watches, warnings and advisories' },
  { key: 'weather', label: 'Weather alerts', desc: 'All other weather hazards' },
];

// Settings tab — account, alert filters, units, map default
export default function SettingsScreen({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const app = useApp();
  const auth = useAuth();
  const s = app.settings;

  return (
    <View style={styles.screen}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Account, alerts, units and map preferences</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {/* Account */}
        <Card style={styles.card}>
          <SectionLabel>Account</SectionLabel>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{auth.user?.name}</Text>
              <Text style={styles.rowMeta}>
                {auth.user?.email} · {auth.user?.role === 'admin' ? 'Administrator' : 'Member'}
              </Text>
            </View>
            <Pressable onPress={auth.signOut} hitSlop={8}>
              <Text style={styles.signOutLink}>Sign out</Text>
            </Pressable>
          </View>
          {(auth.user?.contacts ?? []).map((c) => (
            <View key={c.phone} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowMeta}>
                  {c.phone}
                  {c.email ? ` · ${c.email}` : ''} · emergency contact
                </Text>
              </View>
            </View>
          ))}
          {auth.user?.role === 'admin' ? (
            <Pressable style={styles.adminBtn} onPress={onOpenAdmin}>
              <Text style={styles.adminBtnText}>Open admin dashboard</Text>
            </Pressable>
          ) : null}
        </Card>

        {/* Alert types — filters the feed everywhere */}
        <Card style={styles.card}>
          <SectionLabel>Alert types</SectionLabel>
          {ALERT_TYPES.map((t) => (
            <View key={t.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t.label}</Text>
                <Text style={styles.rowMeta}>{t.desc}</Text>
              </View>
              <Switch
                value={s.enabledTypes[t.key]}
                onValueChange={(v) => app.updateSettings({ enabledTypes: { ...s.enabledTypes, [t.key]: v } })}
                trackColor={{ true: colors.primary, false: colors.inactiveIcon }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </Card>

        {/* Units */}
        <Card style={styles.card}>
          <SectionLabel>Temperature</SectionLabel>
          <View style={styles.segmentRow}>
            {(['fahrenheit', 'celsius'] as const).map((u) => (
              <Pressable
                key={u}
                style={[styles.segment, s.unit === u && styles.segmentActive]}
                onPress={() => app.updateSettings({ unit: u })}
              >
                <Text style={[styles.segmentText, s.unit === u && styles.segmentTextActive]}>
                  {u === 'fahrenheit' ? '°F' : '°C'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Map default */}
        <Card style={styles.card}>
          <SectionLabel>Default map view</SectionLabel>
          <View style={styles.segmentRow}>
            {(['3d', 'street', 'satellite'] as const).map((v) => (
              <Pressable
                key={v}
                style={[styles.segment, s.defaultMapView === v && styles.segmentActive]}
                onPress={() => app.updateSettings({ defaultMapView: v })}
              >
                <Text style={[styles.segmentText, s.defaultMapView === v && styles.segmentTextActive]}>
                  {v === '3d' ? '3D' : v === 'street' ? 'Map' : 'Satellite'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Data sources */}
        <Card style={styles.card}>
          <SectionLabel>Data</SectionLabel>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Alerts</Text>
              <Text style={styles.rowMeta}>GDACS global disasters + US National Weather Service</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Weather</Text>
              <Text style={styles.rowMeta}>Open-Meteo</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Last refresh</Text>
              <Text style={styles.rowMeta}>{app.lastUpdated ? timeAgo(app.lastUpdated) : '—'}</Text>
            </View>
            <Pressable onPress={app.refresh} hitSlop={8}>
              <Text style={styles.refreshLink}>{app.loading ? 'Refreshing…' : 'Refresh'}</Text>
            </Pressable>
          </View>
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  rowTitle: { fontFamily: fonts.sans600, fontSize: 13.5, color: colors.ink },
  rowMeta: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.muted, marginTop: 1 },
  refreshLink: { fontFamily: fonts.sans600, fontSize: 12, color: colors.primary },
  signOutLink: { fontFamily: fonts.sans600, fontSize: 12, color: colors.sos },
  adminBtn: {
    marginTop: 6,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 11,
    alignItems: 'center',
  },
  adminBtnText: { fontFamily: fonts.sora600, fontSize: 13.5, color: '#fff' },

  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.sans600, fontSize: 13, color: colors.bodySoft },
  segmentTextActive: { color: '#fff' },
});
