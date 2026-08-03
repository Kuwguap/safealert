import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { community } from '../api/community';
import { ActiveAlert } from '../api/nws';
import MapPanel, { MapChip, mapChipText } from '../components/MapPanel';
import { BackHeader, Card, LivePill } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useAuth } from '../state/AuthContext';
import { colors, fonts } from '../theme';
import { formatClock, timeAgo } from '../util/geo';

// 2b. Advisory detail (flood & weather alerts) — live NWS data
export default function FloodDetailScreen({ alert, onBack }: { alert: ActiveAlert; onBack: () => void }) {
  const app = useApp();
  const auth = useAuth();
  const [safeSent, setSafeSent] = useState(false);
  const center = alert.centroid ?? app.center;

  const sendSafe = () => {
    if (!safeSent) {
      community.logEvent({
        kind: 'checkin',
        detail: `Marked safe · ${alert.event}`,
        user: auth.user?.name ?? 'Anonymous',
        userEmail: auth.user?.email ?? '',
        locationLabel: app.locationLabel,
        lat: app.center.lat,
        lon: app.center.lon,
        targetEmails: (auth.user?.contacts ?? []).map((c) => c.email).filter(Boolean),
      });
    }
    setSafeSent(true);
  };

  const shortDesc = alert.description.replace(/\s*\n\s*/g, ' ').trim();

  return (
    <View style={styles.screen}>
      <BackHeader
        title={alert.event}
        subtitle={`${alert.areaDesc.split(';')[0]} · updated ${timeAgo(alert.sent)}`}
        subtitleColor={colors.floodMeta}
        onBack={onBack}
        right={<LivePill bg={colors.floodBg} border={colors.floodBorder} color={colors.floodDeep} />}
      />

      <View style={styles.body}>
        {/* Status card */}
        <Card style={styles.statusCard}>
          <Text style={styles.headline} numberOfLines={2}>
            {alert.headline.split(' by NWS')[0]}
          </Text>
          <ScrollView style={styles.descScroll}>
            <Text style={styles.bodyText}>{shortDesc || 'No details provided.'}</Text>
          </ScrollView>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{alert.severity}</Text>
              <Text style={styles.statLabel}>severity</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{alert.urgency}</Text>
              <Text style={styles.statLabel}>urgency</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatClock(alert.expires)}</Text>
              <Text style={styles.statLabel}>expires</Text>
            </View>
          </View>
        </Card>

        {/* Map — satellite with tinted alert zone, centered on the alert area */}
        <MapPanel center={center} zoom={11} variant="flood" ringSize={170} style={styles.map}>
          <MapChip style={{ top: 12, left: 12, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 8 }}>
            <Text style={mapChipText} numberOfLines={1}>
              {alert.event} · {alert.senderName}
            </Text>
          </MapChip>
          {alert.instruction ? (
            <MapChip style={styles.instructionChip}>
              <View style={styles.instructionDot} />
              <Text style={[mapChipText, { fontFamily: fonts.sans400, flex: 1 }]} numberOfLines={2}>
                {alert.instruction.replace(/\s*\n\s*/g, ' ')}
              </Text>
            </MapChip>
          ) : null}
        </MapPanel>
      </View>

      {/* Action row */}
      <View style={styles.actions}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => Linking.openURL('https://www.weather.gov/safety/')}
        >
          <Text style={styles.primaryBtnText}>Safety guidance</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={sendSafe}>
          <Text style={styles.secondaryBtnText}>{safeSent ? 'Sent ✓' : "I'm Safe"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 20,
    gap: 12,
  },
  statusCard: { padding: 14 },
  headline: { fontFamily: fonts.sora700, fontSize: 17, color: colors.ink },
  descScroll: { maxHeight: 96, marginTop: 4 },
  bodyText: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    lineHeight: 19.5,
    color: colors.bodySoft,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  stat: { flex: 1 },
  statValue: { fontFamily: fonts.sora700, fontSize: 17, color: colors.flood },
  statLabel: { fontFamily: fonts.sans400, fontSize: 11, color: colors.muted, marginTop: 1 },

  map: { flex: 1, minHeight: 200 },
  instructionChip: {
    bottom: 12,
    left: 12,
    right: 12,
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderColor: 'rgba(122,165,216,0.25)',
  },
  instructionDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.floodRing },

  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 15,
    backgroundColor: colors.flood,
    borderRadius: 13,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: fonts.sora700, fontSize: 15, color: '#fff' },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 15,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.outlineEmphasis,
    borderRadius: 13,
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: fonts.sora600, fontSize: 15, color: colors.body },
});
