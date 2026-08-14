import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { backend } from '../api/backend';
import { ActivityEvent, community, CommunityAlert } from '../api/community';
import { AlertType } from '../api/nws';
import { BackHeader, Card, SectionLabel } from '../components/ui';
import { sendLocalNotification } from '../notify';
import { useApp } from '../state/AppContext';
import { useAuth } from '../state/AuthContext';
import { colors, fonts } from '../theme';
import { timeAgo } from '../util/geo';

const EVENT_PRESETS: { label: string; type: AlertType }[] = [
  { label: 'AMBER Alert', type: 'amber' },
  { label: 'Flood Warning', type: 'flood' },
  { label: 'Severe Weather', type: 'weather' },
  { label: 'Earthquake', type: 'weather' },
  { label: 'Wildfire', type: 'weather' },
];

const SEVERITIES = ['Minor', 'Moderate', 'Severe', 'Extreme'];

const EVENT_ICONS: Record<ActivityEvent['kind'], { icon: string; color: string; label: string }> = {
  sos: { icon: 'alert-circle', color: colors.sos, label: 'SOS' },
  checkin: { icon: 'checkmark-circle', color: colors.safe, label: "I'm Safe" },
  tip: { icon: 'eye', color: colors.primary, label: 'Sighting tip' },
};

// Admin dashboard (web: /admin) — publish bulletins, send broadcast
// notifications, watch live SOS/check-in/tip activity, and smoke-test
// every feature end to end.
export default function AdminScreen({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const auth = useAuth();
  const [preset, setPreset] = useState(0);
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(1);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [published, setPublished] = useState<CommunityAlert[]>(community.getAlerts());
  const [events, setEvents] = useState<ActivityEvent[]>(community.getEvents());
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [bcastMsg, setBcastMsg] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [ping, setPing] = useState<{ ok: boolean; ms: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    backend.ping().then(setPing);
    return community.subscribe(() => {
      setPublished([...community.getAlerts()]);
      setEvents([...community.getEvents()]);
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([community.poll(), backend.ping().then(setPing)]);
    setRefreshing(false);
  };

  const publish = async () => {
    const chosen = EVENT_PRESETS[preset];
    if (!headline.trim()) {
      setPubMsg('Add a headline first.');
      return;
    }
    const saved = await community.publishAlert({
      source: 'admin',
      type: chosen.type,
      event: chosen.label,
      headline: headline.trim(),
      description: description.trim() || headline.trim(),
      severity: SEVERITIES[severity],
      areaDesc: app.locationLabel,
      lat: app.center.lat,
      lon: app.center.lon,
      author: auth.user?.name ?? 'Admin',
    });
    if (saved.id.startsWith('local-')) {
      setPubMsg('⚠ Server unreachable — saved on this device only. Check your connection and publish again.');
      return;
    }
    setHeadline('');
    setDescription('');
    setPubMsg('✓ Published — reaches every device within ~20s (feed, map, notification).');
  };

  const broadcast = async () => {
    if (!broadcastTitle.trim()) {
      setBcastMsg('Broadcast needs a title.');
      return;
    }
    const saved = await community.publishAlert({
      source: 'broadcast',
      type: 'weather',
      event: broadcastTitle.trim(),
      headline: broadcastBody.trim() || broadcastTitle.trim(),
      description: broadcastBody.trim() || broadcastTitle.trim(),
      severity: 'Moderate',
      areaDesc: 'All users',
      lat: app.center.lat,
      lon: app.center.lon,
      author: auth.user?.name ?? 'Admin',
    });
    if (saved.id.startsWith('local-')) {
      setBcastMsg('⚠ Server unreachable — broadcast NOT sent to other devices. Check your connection and retry.');
      return;
    }
    setBroadcastTitle('');
    setBroadcastBody('');
    setBcastMsg('✓ Broadcast sent — toast + notification on every device.');
  };

  // Each test reports pass/fail right on the panel and produces a visible
  // effect (toast and/or notification) so there's no guessing.
  const smokeTests: { label: string; run: () => Promise<string> }[] = [
    {
      label: 'Notification',
      run: async () => {
        await sendLocalNotification('SafeAlert test', 'Notifications are wired up correctly.');
        app.showNotice({ title: 'SafeAlert test', body: 'In-app toast working — check the notification shade on device.', tone: 'flood' });
        return 'toast shown · notification sent (native)';
      },
    },
    {
      label: 'SOS alert',
      run: async () => {
        await community.logEvent({
          kind: 'sos',
          user: 'Smoke Test',
          userEmail: 'smoke@test',
          detail: 'Simulated SOS — you are the emergency contact',
          locationLabel: app.locationLabel,
          lat: app.center.lat,
          lon: app.center.lon,
          targetEmails: [auth.user?.email ?? ''],
        });
        return 'logged — red SOS toast should appear now';
      },
    },
    {
      label: 'Broadcast',
      run: async () => {
        await community.publishAlert({
          source: 'broadcast',
          type: 'weather',
          event: 'Test broadcast',
          headline: 'Smoke-test broadcast from the admin dashboard — safe to ignore.',
          description: 'Safe to ignore.',
          severity: 'Minor',
          areaDesc: 'All users',
          lat: app.center.lat,
          lon: app.center.lon,
          author: 'Smoke Test',
        });
        return 'published — toast + feed card incoming';
      },
    },
    {
      label: 'Backend ping',
      run: async () => {
        const p = await backend.ping();
        setPing(p);
        if (!p.ok) throw new Error('unreachable');
        return `Supabase OK · ${p.ms} ms`;
      },
    },
    {
      label: 'Refresh feed',
      run: async () => {
        await app.refresh();
        return 'weather + alerts refetched';
      },
    },
    {
      label: 'Clear bulletins',
      run: async () => {
        await community.clearAlerts();
        return 'bulletins cleared on all devices';
      },
    },
    {
      label: 'Clear activity',
      run: async () => {
        await community.clearEvents();
        return 'activity log cleared';
      },
    },
  ];

  const runTest = async (label: string, fn: () => Promise<string>) => {
    setTestResults((r) => ({ ...r, [label]: 'Running…' }));
    try {
      const msg = await fn();
      setTestResults((r) => ({ ...r, [label]: `✓ ${msg}` }));
    } catch {
      setTestResults((r) => ({ ...r, [label]: '✗ Failed — is the device online?' }));
    }
  };

  return (
    <View style={styles.screen}>
      <BackHeader
        title="Admin dashboard"
        subtitle={`${auth.user?.name ?? '—'} · target area ${app.locationLabel}`}
        onBack={onBack}
        right={
          <View style={[styles.statusPill, { borderColor: ping?.ok ? colors.safeBorder : colors.amberBorder }]}>
            <View style={[styles.statusDot, { backgroundColor: ping == null ? colors.inactiveIcon : ping.ok ? colors.safe : colors.sos }]} />
            <Text style={styles.statusText}>{ping == null ? '…' : ping.ok ? `DB ${ping.ms}ms` : 'offline'}</Text>
          </View>
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Publish an alert */}
        <Card style={styles.card}>
          <SectionLabel>Publish alert</SectionLabel>
          <View style={styles.chipRow}>
            {EVENT_PRESETS.map((p, i) => (
              <Pressable key={p.label} style={[styles.chip, preset === i && styles.chipActive]} onPress={() => setPreset(i)}>
                <Text style={[styles.chipText, preset === i && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={headline}
            onChangeText={setHeadline}
            placeholder="Headline — e.g. Flooding expected near Anloga Junction"
            placeholderTextColor={colors.faint}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Details for the alert page (optional)"
            placeholderTextColor={colors.faint}
            multiline
          />
          <View style={styles.chipRow}>
            {SEVERITIES.map((s, i) => (
              <Pressable key={s} style={[styles.chip, severity === i && styles.chipActive]} onPress={() => setSeverity(i)}>
                <Text style={[styles.chipText, severity === i && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.publishBtn} onPress={publish}>
            <Text style={styles.publishText}>Publish to feed</Text>
          </Pressable>
          {pubMsg ? <Text style={styles.confirmation}>{pubMsg}</Text> : null}
        </Card>

        {/* Broadcast notification */}
        <Card style={styles.card}>
          <SectionLabel>Broadcast notification</SectionLabel>
          <TextInput
            style={styles.input}
            value={broadcastTitle}
            onChangeText={setBroadcastTitle}
            placeholder="Title — e.g. System drill at 3 PM"
            placeholderTextColor={colors.faint}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={broadcastBody}
            onChangeText={setBroadcastBody}
            placeholder="Message shown in the toast and notification"
            placeholderTextColor={colors.faint}
            multiline
          />
          <Pressable style={[styles.publishBtn, { backgroundColor: colors.flood }]} onPress={broadcast}>
            <Text style={styles.publishText}>Send broadcast</Text>
          </Pressable>
          {bcastMsg ? <Text style={styles.confirmation}>{bcastMsg}</Text> : null}
        </Card>

        {/* Published bulletins */}
        <Card style={styles.card}>
          <SectionLabel>Published bulletins</SectionLabel>
          {published.length === 0 ? (
            <Text style={styles.emptyText}>Nothing published yet.</Text>
          ) : (
            published.slice(0, 10).map((b) => (
              <View key={b.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {b.source === 'broadcast' ? '📢 ' : ''}
                    {b.event} — {b.headline}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {b.severity} · {b.areaDesc} · {b.author} · {timeAgo(b.sent)}
                  </Text>
                </View>
                <Pressable onPress={() => community.removeAlert(b.id)} hitSlop={8}>
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </Card>

        {/* Incoming activity from the app */}
        <Card style={styles.card}>
          <SectionLabel>Incoming activity</SectionLabel>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>SOS, "I'm Safe" check-ins and sighting tips will appear here.</Text>
          ) : (
            events.slice(0, 12).map((e) => {
              const meta = EVENT_ICONS[e.kind];
              return (
                <View key={e.id} style={styles.row}>
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {meta.label} · {e.user}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[e.detail, e.locationLabel, timeAgo(e.ts)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Smoke tests — result shows under each button */}
        <Card style={styles.card}>
          <SectionLabel>Smoke tests</SectionLabel>
          <View style={styles.testRow}>
            {smokeTests.map((t) => (
              <Pressable
                key={t.label}
                style={[styles.testBtn, testResults[t.label]?.startsWith('✓') && styles.testBtnPass, testResults[t.label]?.startsWith('✗') && styles.testBtnFail]}
                onPress={() => runTest(t.label, t.run)}
              >
                <Text style={styles.testBtnText}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          {smokeTests
            .filter((t) => testResults[t.label])
            .map((t) => (
              <Text
                key={t.label}
                style={[styles.testResult, testResults[t.label].startsWith('✗') && { color: colors.sos }]}
              >
                {t.label}: {testResults[t.label]}
              </Text>
            ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 10, gap: 12 },
  card: { padding: 14 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: fonts.sans600, fontSize: 10.5, color: colors.bodySoft },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
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
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  publishBtn: {
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  publishText: { fontFamily: fonts.sora700, fontSize: 14.5, color: '#fff' },
  confirmation: { fontFamily: fonts.sans500, fontSize: 12.5, color: colors.safe, paddingHorizontal: 4 },
  emptyText: { fontFamily: fonts.sans400, fontSize: 12.5, color: colors.faint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  rowTitle: { fontFamily: fonts.sans600, fontSize: 13, color: colors.ink },
  rowMeta: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.muted, marginTop: 1 },
  removeLink: { fontFamily: fonts.sans600, fontSize: 12, color: colors.sos },
  testRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  testBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.outlineEmphasis,
    borderRadius: 11,
    backgroundColor: colors.card,
  },
  testBtnText: { fontFamily: fonts.sans600, fontSize: 12.5, color: colors.body },
  testBtnPass: { borderColor: colors.safeRing, backgroundColor: colors.safeBg },
  testBtnFail: { borderColor: colors.sos, backgroundColor: '#fdeaea' },
  testResult: { fontFamily: fonts.sans500, fontSize: 11.5, color: colors.safeMeta, marginTop: 8 },
});
