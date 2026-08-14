import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { community } from '../api/community';
import { composeSms, sosMessage } from '../api/sms';
import { Card, SectionLabel } from '../components/ui';
import { sendLocalNotification } from '../notify';
import { useApp } from '../state/AppContext';
import { useAuth } from '../state/AuthContext';
import { colors, fonts } from '../theme';
import { timeAgo } from '../util/geo';

// Ghana emergency directory.
const quickDial = [
  {
    id: 'police',
    name: 'Police / DOVSU',
    org: 'Emergency & victim support (Social Welfare)',
    tint: '#e8eef6',
    callLabel: 'Call 191',
    tel: '191',
  },
  {
    id: 'missing',
    name: 'Missing Children Ghana',
    org: 'NGO helpline · alt 050 122 2665',
    tint: '#fef3c7',
    callLabel: 'Call',
    tel: '+233594594662',
  },
  {
    id: 'nadmo',
    name: 'NADMO',
    org: 'Disaster management · alt 0299 350 030',
    tint: '#fdeaea',
    callLabel: 'Call 122',
    tel: '122',
  },
  {
    id: 'poison',
    name: 'Poison Control (GPCC)',
    org: 'Ghana Health Service · 24/7',
    tint: '#e9f0e6',
    callLabel: 'Call',
    tel: '0202222174',
  },
];

const SOS_SIZE = 88;
const RING_R = (SOS_SIZE + 8) / 2; // progress ring just outside the button
const RING_C = 2 * Math.PI * RING_R;
const HOLD_MS = 1500;

type SosState = 'idle' | 'holding' | 'sent';

// Press-and-hold ~1.5s with progress ring, then shares live location
// with 3 emergency contacts + hotline (mocked here).
function SosButton({ state, setState }: { state: SosState; setState: (s: SosState) => void }) {
  const [progress, setProgress] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicking = () => {
    if (interval.current) {
      clearInterval(interval.current);
      interval.current = null;
    }
  };
  useEffect(() => stopTicking, []);

  const startHold = () => {
    if (state === 'sent') return;
    setState('holding');
    const startedAt = Date.now();
    interval.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        stopTicking();
        setState('sent');
      }
    }, 33);
  };

  const cancelHold = () => {
    if (state !== 'holding') return;
    stopTicking();
    setProgress(0);
    setState('idle');
  };

  const ringSize = SOS_SIZE + 16;
  // Raw responder API rather than Pressable: press-in must fire the instant
  // the finger lands (no gesture arbitration delay) for a hold-to-send control.
  return (
    <View
      style={styles.sosWrap}
      onStartShouldSetResponder={() => true}
      onResponderGrant={startHold}
      onResponderRelease={cancelHold}
      onResponderTerminate={cancelHold}
    >
      <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sosGrad" cx="35%" cy="30%" r="80%">
            <Stop offset="0%" stopColor={colors.sosLight} />
            <Stop offset="100%" stopColor={colors.sos} />
          </RadialGradient>
        </Defs>
        <Circle cx={ringSize / 2} cy={ringSize / 2} r={SOS_SIZE / 2} fill="url(#sosGrad)" />
        {progress > 0 || state === 'sent' ? (
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={RING_R}
            fill="none"
            stroke={state === 'sent' ? colors.safe : colors.sos}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${RING_C}`}
            strokeDashoffset={RING_C * (1 - (state === 'sent' ? 1 : progress))}
            rotation={-90}
            originX={ringSize / 2}
            originY={ringSize / 2}
          />
        ) : null}
      </Svg>
      <Text style={styles.sosLabel}>{state === 'sent' ? '✓' : 'SOS'}</Text>
    </View>
  );
}

// 2c. Emergency tools — SOS, check-in, directory
export default function EmergencyScreen() {
  const app = useApp();
  const auth = useAuth();
  const [sosState, setSosState] = useState<SosState>('idle');
  const [checkInSent, setCheckInSent] = useState(false);

  const contacts = auth.user?.contacts ?? [];

  const logEvent = (kind: 'sos' | 'checkin', detail: string) =>
    community.logEvent({
      kind,
      detail,
      user: auth.user?.name ?? 'Anonymous',
      userEmail: auth.user?.email ?? '',
      locationLabel: app.locationLabel,
      lat: app.center.lat,
      lon: app.center.lon,
      // contacts with SafeAlert emails get the in-app SOS notice
      targetEmails: contacts.map((c) => c.email).filter(Boolean),
    });

  const sendSms = () => composeSms(contacts, sosMessage(auth.user?.name ?? 'me', app.center, app.locationLabel));

  const onSosStateChange = (s: SosState) => {
    setSosState(s);
    if (s === 'sent') {
      // 1. in-app alarm for contacts on SafeAlert (via the backend event)
      logEvent('sos', `Live location: ${app.center.lat.toFixed(4)}, ${app.center.lon.toFixed(4)}`);
      // 2. carrier SMS to every contact — composer opens prefilled with the
      //    location link; works on any Ghanaian number, no gateway needed
      sendSms();
    }
  };

  const callFirst = () => {
    const first = contacts[0];
    if (first?.phone) Linking.openURL(`tel:${first.phone.replace(/[^+\d]/g, '')}`).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Emergency</Text>
        <Text style={styles.subtitle}>Tools that work even with low connectivity</Text>
      </View>

      <View style={styles.body}>
        {/* SOS card */}
        <Card style={styles.sosCard}>
          <SosButton state={sosState} setState={onSosStateChange} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>{sosState === 'sent' ? 'SOS sent' : 'Hold to send SOS'}</Text>
            <Text style={styles.sosText}>
              {sosState === 'sent'
                ? contacts.length
                  ? `In-app alarm + SMS sent to ${contacts.map((c) => c.name).join(', ')}.`
                  : 'SOS logged. Add emergency contacts at signup to alert your people.'
                : contacts.length
                  ? `Alarms ${contacts.map((c) => c.name).join(', ')} in-app and texts them your live location.`
                  : 'Shares your live location with your emergency contacts and the local hotline.'}
            </Text>
            {sosState === 'sent' && contacts.length ? (
              <View style={styles.sosActions}>
                <Pressable style={styles.sosActionBtn} onPress={callFirst}>
                  <Text style={styles.sosActionText}>📞 Call {contacts[0]?.name}</Text>
                </Pressable>
                <Pressable style={styles.sosActionBtn} onPress={sendSms}>
                  <Text style={styles.sosActionText}>✉️ Resend SMS</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Card>

        {/* "I'm Safe" check-in */}
        <View style={styles.safeCard}>
          <View style={styles.safeCheck}>
            <Text style={styles.safeCheckMark}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.safeTitle}>"I'm Safe" check-in</Text>
            <Text style={styles.safeMeta}>Let contacts know you're okay during an active alert</Text>
          </View>
          <Pressable
            style={styles.safeBtn}
            onPress={() => {
              if (!checkInSent) logEvent('checkin', 'Marked safe during active alert');
              setCheckInSent(true);
            }}
          >
            <Text style={styles.safeBtnText}>{checkInSent ? 'Sent ✓' : 'Send'}</Text>
          </Pressable>
        </View>

        {/* Quick dial */}
        <Card style={styles.dialCard}>
          <SectionLabel>Quick dial</SectionLabel>
          <View style={{ gap: 8 }}>
            {quickDial.map((entry) => (
              <View key={entry.id} style={styles.dialRow}>
                <View style={[styles.dialIcon, { backgroundColor: entry.tint }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dialName}>{entry.name}</Text>
                  <Text style={styles.dialOrg}>{entry.org}</Text>
                </View>
                <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${entry.tel}`)}>
                  <Text style={styles.callBtnText}>{entry.callLabel}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>

        {/* Preview how an incoming SOS looks — available to every account */}
        <View style={styles.previewCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle}>Incoming SOS preview</Text>
            <Text style={styles.previewMeta}>
              See exactly what appears when someone who listed you as an emergency contact sends an SOS.
            </Text>
          </View>
          <Pressable
            style={styles.previewBtn}
            onPress={() => {
              const title = '🆘 SOS from Kofi (preview)';
              const body = `${app.locationLabel} · Live location shared — this is a preview`;
              app.showNotice({ title, body, tone: 'sos' });
              sendLocalNotification(title, body);
            }}
          >
            <Text style={styles.previewBtnText}>Preview</Text>
          </Pressable>
        </View>

        {/* Data freshness status line */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, !app.lastUpdated && { backgroundColor: colors.inactiveIcon }]} />
          <Text style={styles.statusText}>
            {app.lastUpdated
              ? `Alerts last updated ${timeAgo(app.lastUpdated)} · ${app.locationLabel}`
              : app.error ?? 'Waiting for alert data…'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.sora700, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.sans400, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  body: { flex: 1, paddingTop: 8, paddingHorizontal: 20, gap: 12 },

  sosCard: {
    padding: 20,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  sosWrap: {
    width: SOS_SIZE + 16,
    height: SOS_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosLabel: {
    fontFamily: fonts.sora800,
    fontSize: 20,
    color: '#fff',
    letterSpacing: 0.8,
  },
  sosTitle: { fontFamily: fonts.sora700, fontSize: 16, color: colors.ink },
  sosActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  sosActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.sos,
    borderRadius: 999,
  },
  sosActionText: { fontFamily: fonts.sans600, fontSize: 12, color: colors.sos },
  sosText: {
    fontFamily: fonts.sans400,
    fontSize: 12.5,
    lineHeight: 18.75,
    color: colors.bodySoft,
    marginTop: 3,
  },

  safeCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.safeBg,
    borderWidth: 1,
    borderColor: colors.safeBorder,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  safeCheck: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.safeRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeCheckMark: { fontSize: 16, color: colors.safe },
  safeTitle: { fontFamily: fonts.sora600, fontSize: 14, color: colors.safeDeep },
  safeMeta: { fontFamily: fonts.sans400, fontSize: 12, color: colors.safeMeta, marginTop: 1 },
  safeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.safe,
    borderRadius: 999,
  },
  safeBtnText: { fontFamily: fonts.sans600, fontSize: 12.5, color: '#fff' },

  dialCard: { padding: 14 },
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
  },
  dialIcon: { width: 32, height: 32, borderRadius: 9 },
  dialName: { fontFamily: fonts.sans600, fontSize: 13.5, color: colors.ink },
  dialOrg: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.muted },
  callBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.outlineEmphasis,
    borderRadius: 999,
  },
  callBtnText: { fontFamily: fonts.sans600, fontSize: 12, color: colors.body },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
  },
  previewTitle: { fontFamily: fonts.sans600, fontSize: 13, color: colors.ink },
  previewMeta: { fontFamily: fonts.sans400, fontSize: 11.5, lineHeight: 15.5, color: colors.muted, marginTop: 2 },
  previewBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.sos,
    borderRadius: 999,
  },
  previewBtnText: { fontFamily: fonts.sans600, fontSize: 12.5, color: colors.sos },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.safeRing },
  statusText: { flex: 1, fontFamily: fonts.sans400, fontSize: 12, color: colors.muted },
});
