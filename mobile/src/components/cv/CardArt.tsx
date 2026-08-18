import { useEffect, useState } from 'react';
import { Image, Text, View, StyleSheet, type ImageResizeMode, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme/tokens';
import { shotSource } from '@/lib/shotMode';

interface Props {
  /** TCGdex / DB image URL. When missing or fails to load, an emoji
   *  placeholder is rendered — the user's scan capture is never used as
   *  card art (that's OCR input only). */
  uri: string | null | undefined;
  resizeMode?: ImageResizeMode;
  emoji?: string;
  emojiSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function CardArt({ uri, resizeMode = 'contain', emoji = '🃏', emojiSize = 36, style }: Props) {
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [uri]);
  const showImage = Boolean(uri) && !errored;
  return (
    <View style={[styles.wrap, style]}>
      {showImage ? (
        <Image
          source={shotSource(uri)}
          style={StyleSheet.absoluteFillObject}
          resizeMode={resizeMode}
          onError={() => setErrored(true)}
        />
      ) : (
        <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pap3,
  },
});
