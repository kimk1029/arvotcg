/**
 * /my/shop — 꾸미기 샵.
 * 인벤토리는 /api/me/inventory 에서, 구매는 /api/me/inventory/buy 로 라우팅.
 */
import { useState } from 'react';
import { ScrollView, View, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AppBar } from '@/components/AppBar';
import { PixelText } from '@/components/PixelText';
import { PixelFrame } from '@/components/cv/PixelFrame';
import { PixelPress } from '@/components/cv/PixelPress';
import { SectHd } from '@/components/cv/SectHd';
import { EmptyState, ErrorView, LoadingState } from '@/components/cv/ListState';
import { AVATARS, BACKGROUNDS, FRAMES } from '@/data/shopCatalog';
import { fetchInventory, buyOrPick, type ShopKind, type InventorySnapshot } from '@/lib/myApi';
import { useAsync } from '@/lib/useAsync';
import { colors } from '@/theme/tokens';
import { useTheme, useThemeColors, useThemeTextVariant } from '@/components/ThemeProvider';
import { isFlatTheme } from '@/lib/theme';

type Tab = ShopKind;
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'avatar', label: '아바타' },
  { id: 'bg', label: '배경' },
  { id: 'frame', label: '테두리' },
];

export default function ShopScreen() {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const flat = isFlatTheme(useTheme().theme);
  const [tab, setTab] = useState<Tab>('avatar');
  const [pending, setPending] = useState<string | null>(null);
  const { data, loading, error, refresh } = useAsync(fetchInventory);

  const inv = data?.inventory ?? null;

  const handleAction = async (kind: ShopKind, id: string, price: number, owned: boolean) => {
    if (pending) return;
    setPending(id);
    try {
      const r = await buyOrPick(owned ? 'pick' : 'buy', kind, id, price);
      if (r.ok) {
        refresh();
        Alert.alert(owned ? '적용 완료' : '구매 완료', owned ? `${id} 적용됨` : `${id} 획득!`);
      } else {
        Alert.alert('실패', r.error ?? '알 수 없는 오류');
      }
    } catch (err) {
      Alert.alert('오류', err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tc.paper }}>
      <AppBar
        onBack={() => router.back()}
        title="꾸미기 샵"
        right={
          inv ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: tc.gold, borderColor: tc.ink, borderWidth: flat ? 0 : 2, borderRadius: flat ? 8 : 0 }}>
              <PixelText variant={txt} size={9} color={tc.ink} weight="bold">
                {inv.points.toLocaleString('ko-KR')}P
              </PixelText>
            </View>
          ) : null
        }
      />

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <View style={{ margin: 14 }}>
          <ErrorView error={error} onRetry={refresh} />
        </View>
      ) : !inv ? (
        <View style={{ margin: 14 }}>
          <EmptyState icon="🏪" title="샵을 불러오지 못했어요" onCtaPress={refresh} ctaLabel="다시 시도" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 110 }}>
          {/* TAB BAR */}
          <View style={{ flexDirection: 'row', marginHorizontal: 14, marginBottom: 14, gap: 6 }}>
            {TABS.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  backgroundColor: tab === t.id ? tc.ink : tc.white,
                  borderColor: flat ? (tab === t.id ? tc.ink : tc.pap3) : tc.ink,
                  borderWidth: flat ? 1 : 3,
                  borderRadius: flat ? 10 : 0,
                  alignItems: 'center',
                }}
              >
                <PixelText variant={txt} size={10} color={tab === t.id ? tc.gold : tc.ink}>
                  {t.label}
                </PixelText>
              </Pressable>
            ))}
          </View>

          <View style={{ marginHorizontal: 14 }}>
            <SectHd title={TABS.find((x) => x.id === tab)?.label ?? ''} />
            {tab === 'avatar' ? (
              <AvatarGrid inv={inv} pending={pending} onAction={handleAction} />
            ) : tab === 'bg' ? (
              <BgGrid inv={inv} pending={pending} onAction={handleAction} />
            ) : (
              <FrameGrid inv={inv} pending={pending} onAction={handleAction} />
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

interface GridProps {
  inv: InventorySnapshot;
  pending: string | null;
  onAction: (kind: ShopKind, id: string, price: number, owned: boolean) => void;
}

function AvatarGrid({ inv, pending, onAction }: GridProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {AVATARS.map((a) => {
        const owned = inv.avatarOwned.includes(a.id);
        const equipped = inv.avatar === a.id;
        const price = a.price ?? 0;
        return (
          <ItemTile
            key={a.id}
            preview={a.glyph}
            name={a.name}
            price={a.mode === 'level' ? `LV.${a.level}` : price}
            tag={a.tag}
            owned={owned}
            equipped={equipped}
            locked={a.mode === 'level' ? !owned : false}
            pending={pending === a.id}
            onPress={() => onAction('avatar', a.id, price, owned)}
          />
        );
      })}
    </View>
  );
}

function BgGrid({ inv, pending, onAction }: GridProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {BACKGROUNDS.map((b) => {
        const owned = inv.bgOwned.includes(b.id);
        const equipped = inv.bg === b.id;
        return (
          <ItemTile
            key={b.id}
            preview={b.preview}
            name={b.name}
            price={b.price}
            tag={b.tag}
            owned={owned}
            equipped={equipped}
            pending={pending === b.id}
            onPress={() => onAction('bg', b.id, b.price, owned)}
          />
        );
      })}
    </View>
  );
}

function FrameGrid({ inv, pending, onAction }: GridProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {FRAMES.map((f) => {
        const owned = inv.frameOwned.includes(f.id);
        const equipped = inv.frame === f.id;
        return (
          <ItemTile
            key={f.id}
            preview={f.preview}
            name={f.name}
            price={f.price}
            tag={f.tag}
            owned={owned}
            equipped={equipped}
            pending={pending === f.id}
            onPress={() => onAction('frame', f.id, f.price, owned)}
          />
        );
      })}
    </View>
  );
}

interface TileProps {
  preview: string;
  name: string;
  price: number | string;
  tag?: 'hot' | 'new' | 'legend';
  owned: boolean;
  equipped: boolean;
  locked?: boolean;
  pending: boolean;
  onPress: () => void;
}

const TAG_STYLE: Record<NonNullable<TileProps['tag']>, { bg: string; fg: string; label: string }> = {
  hot: { bg: colors.red, fg: colors.white, label: 'HOT' },
  new: { bg: colors.grn, fg: colors.white, label: 'NEW' },
  legend: { bg: colors.pur, fg: colors.white, label: '전설' },
};

function ItemTile({ preview, name, price, tag, owned, equipped, locked, pending, onPress }: TileProps) {
  const tc = useThemeColors();
  const txt = useThemeTextVariant();
  const flat = isFlatTheme(useTheme().theme);
  const bg = equipped ? tc.gold : owned ? tc.pap2 : tc.white;
  return (
    <View style={{ width: '31%' }}>
      <PixelPress
        onPress={onPress}
        bg={bg}
        borderWidth={2}
        shadow={3}
        hi={null}
        lo={null}
        inner={0}
        disabled={pending || locked}
        style={{ opacity: pending ? 0.5 : 1 }}
      >
        <View style={{ padding: 8, alignItems: 'center', gap: 4 }}>
          <View style={{ width: '100%', height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)' }}>
            <PixelText variant={txt} size={26} color={tc.ink}>{preview}</PixelText>
          </View>
          <PixelText variant="ko" size={9} color={tc.ink} weight="bold" numberOfLines={1}>{name}</PixelText>
          {tag ? (
            <View style={{ paddingHorizontal: 4, backgroundColor: TAG_STYLE[tag].bg, borderColor: tc.ink, borderWidth: flat ? 0 : 1, borderRadius: flat ? 4 : 0 }}>
              <PixelText variant={txt} size={7} color={TAG_STYLE[tag].fg}>{TAG_STYLE[tag].label}</PixelText>
            </View>
          ) : null}
          <View style={{ height: 14, alignItems: 'center', justifyContent: 'center' }}>
            {equipped ? (
              <PixelText variant={txt} size={8} color={tc.ink} weight="bold">사용 중</PixelText>
            ) : owned ? (
              <PixelText variant={txt} size={8} color={tc.blu}>탭하여 적용</PixelText>
            ) : locked ? (
              <PixelText variant={txt} size={8} color={tc.ink3}>{price}</PixelText>
            ) : (
              <PixelText variant={txt} size={8} color={tc.red}>{typeof price === 'number' ? `${price.toLocaleString('ko-KR')}P` : price}</PixelText>
            )}
          </View>
        </View>
      </PixelPress>
    </View>
  );
}
