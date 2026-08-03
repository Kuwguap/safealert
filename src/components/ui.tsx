import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// 11.5px uppercase section label, letter-spacing 0.1em, brand amber
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

interface BackHeaderProps {
  title: string;
  subtitle: string;
  subtitleColor?: string;
  onBack: () => void;
  right?: React.ReactNode;
}

// Circular back button + title/meta header shared by detail screens
export function BackHeader({ title, subtitle, subtitleColor = colors.muted, onBack, right }: BackHeaderProps) {
  return (
    <View style={styles.backHeader}>
      <Pressable onPress={onBack} style={styles.backCircle} hitSlop={8}>
        <Text style={styles.backChevron}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.backTitle}>{title}</Text>
        <Text style={[styles.backSubtitle, { color: subtitleColor }]}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

export function LivePill({ bg, border, color }: { bg: string; border: string; color: string }) {
  return (
    <View style={[styles.livePill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.livePillText, { color }]}>LIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
  },
  sectionLabel: {
    fontFamily: fonts.sans600,
    fontSize: 11.5,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
    color: colors.primary,
    marginBottom: 10,
  },
  backHeader: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontSize: 16,
    color: colors.bodySoft,
    marginTop: -2,
  },
  backTitle: {
    fontFamily: fonts.sora700,
    fontSize: 16,
    color: colors.ink,
  },
  backSubtitle: {
    fontFamily: fonts.sans400,
    fontSize: 12,
  },
  livePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 999,
  },
  livePillText: {
    fontFamily: fonts.sans600,
    fontSize: 11,
    letterSpacing: 0.88,
  },
});
