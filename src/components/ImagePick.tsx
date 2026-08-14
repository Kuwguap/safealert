import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { uploadImage } from '../api/storage';
import { colors, fonts } from '../theme';

// Photo attach for alerts: pick from the gallery (native + web), preview,
// and upload to Supabase Storage on demand.

export function usePickedImage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setBase64(result.assets[0].base64);
      setPreview(result.assets[0].uri);
    } catch {
      // picker unavailable — button simply does nothing
    }
  };

  const clear = () => {
    setPreview(null);
    setBase64(null);
  };

  // returns the public URL, or null (none picked / upload failed)
  const upload = async (): Promise<string | null> => {
    if (!base64) return null;
    setUploading(true);
    try {
      return await uploadImage(base64);
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { preview, hasImage: !!base64, uploading, pick, clear, upload };
}

export function ImageAttach({
  picked,
}: {
  picked: ReturnType<typeof usePickedImage>;
}) {
  return picked.preview ? (
    <View style={styles.previewWrap}>
      <Image source={{ uri: picked.preview }} style={styles.preview} resizeMode="cover" />
      <Pressable style={styles.remove} onPress={picked.clear} hitSlop={8}>
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>
      {picked.uploading ? (
        <View style={styles.uploadingBadge}>
          <Text style={styles.uploadingText}>Uploading…</Text>
        </View>
      ) : null}
    </View>
  ) : (
    <Pressable style={styles.attach} onPress={picked.pick}>
      <Ionicons name="image-outline" size={16} color={colors.bodySoft} />
      <Text style={styles.attachText}>Add photo</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.outlineEmphasis,
    borderRadius: 11,
    marginBottom: 8,
  },
  attachText: { fontFamily: fonts.sans600, fontSize: 13, color: colors.bodySoft },
  previewWrap: { marginBottom: 8 },
  preview: { width: '100%', height: 150, borderRadius: 11, backgroundColor: colors.insetBg },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(13,22,38,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(13,22,38,0.75)',
  },
  uploadingText: { fontFamily: fonts.sans600, fontSize: 11, color: '#fff' },
});
