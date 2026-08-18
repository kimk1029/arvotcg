import { useEffect, useState } from 'react';
import { Image, type ImageProps, type ImageResizeMode, type StyleProp, type ImageStyle } from 'react-native';
import { shotSource } from '@/lib/shotMode';

interface Props extends Omit<ImageProps, 'source' | 'style'> {
  /** Preferred remote source — typically TCGdex card art. */
  uri: string | null | undefined;
  /** Local fallback used when `uri` is null OR fails to load. */
  fallbackUri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Resize mode used when falling back to the local capture (usually 'cover'). */
  fallbackResizeMode?: ImageResizeMode;
}

/**
 * <Image> wrapper that swaps to a local URI when the remote fetch fails. The
 * TCGdex CDN is usually reliable, but assets for very new sets can be missing
 * or temporarily 5xx — without a fallback the slot just rendered blank.
 */
export function FallbackImage({
  uri,
  fallbackUri,
  style,
  resizeMode,
  fallbackResizeMode,
  ...rest
}: Props) {
  const [errored, setErrored] = useState(false);
  // Reset when the upstream URI changes (e.g. a different card resolved).
  useEffect(() => {
    setErrored(false);
  }, [uri]);
  const useFallback = !uri || errored;
  return (
    <Image
      {...rest}
      source={shotSource(useFallback ? fallbackUri : uri)}
      style={style}
      resizeMode={useFallback ? (fallbackResizeMode ?? resizeMode) : resizeMode}
      onError={(e) => {
        setErrored(true);
        rest.onError?.(e);
      }}
    />
  );
}
