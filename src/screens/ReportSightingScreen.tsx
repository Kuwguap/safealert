import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { community } from '../api/community';
import { BackHeader, Card, SectionLabel } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useAuth } from '../state/AuthContext';
import { colors, fonts } from '../theme';

const SIGHTING_OPTIONS = ['The child', 'The vehicle', 'The suspect'] as const;

// 1c (carried forward with SafeAlert branding). Report a sighting — one-tap tip
export default function ReportSightingScreen({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const auth = useAuth();
  const [selected, setSelected] = useState(0);
  const [details, setDetails] = useState('');
  const [shareCallback, setShareCallback] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  return (
    <View style={styles.screen}>
      <BackHeader title="Report a sighting" subtitle="Goes directly to the agency tip line" onBack={onBack} />

      <View style={styles.body}>
        {/* What did you see? */}
        <Card style={styles.card}>
          <SectionLabel>What did you see?</SectionLabel>
          <View style={{ gap: 8 }}>
            {SIGHTING_OPTIONS.map((label, i) => {
              const active = selected === i;
              return (
                <Pressable key={label} style={[styles.radioRow, active && styles.radioRowActive]} onPress={() => setSelected(i)}>
                  <View style={[styles.radio, active ? styles.radioActive : styles.radioIdle]} />
                  <Text style={[styles.radioLabel, active && styles.radioLabelActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Where & when */}
        <Card style={styles.card}>
          <SectionLabel>Where &amp; when</SectionLabel>
          <View style={styles.locationRow}>
            <View style={styles.locationDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>Current location</Text>
              <Text style={styles.locationMeta}>{app.locationLabel} · just now</Text>
            </View>
            <Pressable hitSlop={8}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
        </Card>

        {/* Details (optional) */}
        <Card style={styles.card}>
          <SectionLabel>Details (optional)</SectionLabel>
          <TextInput
            style={styles.detailsInput}
            value={details}
            onChangeText={setDetails}
            placeholder="Direction of travel, who they were with, anything notable…"
            placeholderTextColor={colors.faint}
            multiline
          />
          <Pressable style={styles.photoBtn}>
            <Text style={styles.photoBtnText}>Add photo or video</Text>
          </Pressable>
        </Card>

        {/* Callback consent */}
        <Pressable style={styles.consentRow} onPress={() => setShareCallback((v) => !v)}>
          <View style={[styles.checkbox, !shareCallback && styles.checkboxOff]}>
            {shareCallback ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.consentText}>Share my callback number with the investigating agency</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.submitBtn, submitted && styles.submitBtnDone]}
          onPress={() => {
            if (!submitted) {
              community.logEvent({
                kind: 'tip',
                detail: `Saw ${SIGHTING_OPTIONS[selected].toLowerCase()}${details.trim() ? ` — ${details.trim()}` : ''}`,
                user: auth.user?.name ?? 'Anonymous',
                userEmail: auth.user?.email ?? '',
                locationLabel: app.locationLabel,
                lat: app.center.lat,
                lon: app.center.lon,
                targetEmails: [],
              });
            }
            setSubmitted(true);
          }}
        >
          <Text style={styles.submitText}>{submitted ? 'Tip submitted ✓' : 'Submit tip'}</Text>
        </Pressable>
        <Text style={styles.footnote}>If this is an emergency, call 911</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: {
    flex: 1,
    paddingTop: 6,
    paddingHorizontal: 20,
    gap: 12,
    justifyContent: 'space-evenly',
  },
  card: { padding: 14 },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: 11,
  },
  radioRowActive: {
    backgroundColor: colors.amberBg,
    borderColor: colors.amberDot,
  },
  radio: { width: 18, height: 18, borderRadius: 9 },
  radioIdle: { borderWidth: 1.5, borderColor: colors.radioBorder },
  radioActive: { borderWidth: 5, borderColor: colors.primary },
  radioLabel: { fontFamily: fonts.sans400, fontSize: 14, color: colors.body },
  radioLabelActive: { fontFamily: fonts.sans600, color: colors.ink },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
  },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amberDot },
  locationTitle: { fontFamily: fonts.sans600, fontSize: 13.5, color: colors.ink },
  locationMeta: { fontFamily: fonts.sans400, fontSize: 12, color: colors.muted },
  editLink: { fontFamily: fonts.sans600, fontSize: 12, color: colors.primary },

  detailsInput: {
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    minHeight: 56,
    fontFamily: fonts.sans400,
    fontSize: 13.5,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  photoBtn: {
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.outlineEmphasis,
    borderRadius: 11,
    alignItems: 'center',
  },
  photoBtnText: { fontFamily: fonts.sans600, fontSize: 13, color: colors.bodySoft },

  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.radioBorder,
  },
  checkboxMark: { fontSize: 9, color: '#fff' },
  consentText: {
    flex: 1,
    fontFamily: fonts.sans400,
    fontSize: 12,
    lineHeight: 17.4,
    color: colors.muted,
  },

  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  submitBtn: {
    paddingVertical: 16,
    backgroundColor: colors.primary,
    borderRadius: 13,
    alignItems: 'center',
  },
  submitBtnDone: { backgroundColor: colors.safe },
  submitText: { fontFamily: fonts.sora700, fontSize: 15, color: '#fff' },
  footnote: {
    textAlign: 'center',
    fontFamily: fonts.sans400,
    fontSize: 11.5,
    color: colors.faint,
    marginTop: 8,
  },
});
