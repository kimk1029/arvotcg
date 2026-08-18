import { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '@/theme/tokens';
import { PixelText } from '../PixelText';
import { displayCardName, gameColors, type CardItem } from '@/data/cardvault';
import { shotSource } from '@/lib/shotMode';

interface Props {
  card: CardItem;
  height?: number;
  emojiSize?: number;
  showLabel?: boolean;
}

/** Card image placeholder with diagonal gradient + scanline overlay + emoji + bottom label.
 *  When `card.imageUrl` is present, renders the real card art (TCGdex or
 *  user-captured scan) as the background instead of the emoji. Emoji shows
 *  on load failure so the slot is never empty. */
export function CardThumb({
  card,
  height = 110,
  emojiSize = 36,
  showLabel = true,
}: Props) {
  const tint = gameColors[card.game] || '#1E293B';
  const [imgErrored, setImgErrored] = useState(false);
  const hasImage = Boolean(card.imageUrl) && !imgErrored;
  return (
    <View style={[styles.wrap, { height, backgroundColor: tint + '33' }]}>
      {hasImage ? (
        <Image
          source={shotSource(card.imageUrl)}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => setImgErrored(true)}
        />
      ) : (
        <>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.ink2, opacity: 0.55 }]} />
          <Text style={{ fontSize: emojiSize }}>{card.emoji}</Text>
        </>
      )}
      {showLabel ? (
        <View style={styles.label}>
          <PixelText
            variant="pixel"
            size={9}
            color="rgba(255,255,255,0.7)"
            numberOfLines={1}
            style={{ textAlign: 'center', letterSpacing: 0.5 }}
          >
            {displayCardName(card.name)}
          </PixelText>
        </View>
      ) : null}
      {/* scanline overlay */}
      <View pointerEvents="none" style={styles.scanlines} />
      {/* inset top dark, bottom highlight */}
      <View pointerEvents="none" style={styles.insetTop} />
      <View pointerEvents="none" style={styles.insetBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    alignItems: 'center',
  },
  scanlines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
    opacity: 0,
  },
  insetTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  insetBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
