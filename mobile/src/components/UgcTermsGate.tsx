/**
 * 커뮤니티 이용규칙(UGC EULA) 동의 게이트 — App Store 심사 지침 1.2 요건.
 * 웹 src/components/UgcTermsGate.tsx 와 페어(같은 플로우):
 * 글·댓글 POST 직전 `if (!(await ensureUgcTerms())) return;`
 *  - GET /api/me/ugc-terms 동의 기록 있으면 즉시 true (세션 내 캐시)
 *  - 없으면 루트 <UgcTermsGateHost/> 가 모달 → 체크+동의 → POST → true / 취소 → false
 *  - 비로그인(401)이면 true — 기존 로그인 게이트(401 처리)에 맡긴다.
 */
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { UGC_AGREE_LABEL, UGC_RULES, UGC_TERMS_INTRO, UGC_TERMS_TITLE } from '../../../shared/ugcTerms';
import { ApiError } from '@/lib/apiClient';
import { agreeUgcTerms as postAgree, fetchUgcTerms } from '@/lib/myApi';
import { getWebBaseUrl } from '@/lib/apiClient';
import { useThemeColors } from '@/components/ThemeProvider';

let agreedCache: boolean | null = null;
let pending: { resolve: (ok: boolean) => void } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** 로그아웃/계정 전환 시 캐시 초기화. */
export function resetUgcTermsCache() {
  agreedCache = null;
}

export async function ensureUgcTerms(): Promise<boolean> {
  if (agreedCache === true) return true;
  let agreed: boolean | null;
  try {
    agreed = (await fetchUgcTerms()).agreed;
  } catch (e) {
    // 401 비로그인 → 로그인 게이트가 처리. 404 = 라우트 없는 구버전 서버 → 게이트 건너뜀(글쓰기 차단 방지).
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return true;
    agreed = false;
  }
  if (agreed) {
    agreedCache = true;
    return true;
  }
  if (pending) return new Promise((resolve) => listeners.add(() => resolve(agreedCache === true)));
  return new Promise<boolean>((resolve) => {
    pending = { resolve };
    notify();
  });
}

function finish(ok: boolean) {
  const p = pending;
  pending = null;
  notify();
  p?.resolve(ok);
}

export function UgcTermsGateHost() {
  const tc = useThemeColors();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const l = () => {
      setOpen(!!pending);
      if (!pending) {
        setChecked(false);
        setErr(null);
      }
    };
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const agree = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await postAgree();
      agreedCache = true;
      finish(true);
    } catch {
      setErr('동의 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish(false)}>
      <Pressable onPress={() => finish(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{ maxHeight: '88%', backgroundColor: tc.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 }}
        >
          <ScrollView bounces={false}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: tc.ink, marginBottom: 8 }}>{UGC_TERMS_TITLE}</Text>
            <Text style={{ fontSize: 13, lineHeight: 21, color: tc.ink2, marginBottom: 12 }}>{UGC_TERMS_INTRO}</Text>
            {UGC_RULES.map((r, i) => (
              <View key={r} style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                <Text style={{ fontSize: 12.5, lineHeight: 20, color: tc.ink, width: 16 }}>{i + 1}.</Text>
                <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 20, color: tc.ink }}>{r}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 12, color: tc.ink3, marginTop: 8 }}>
              전체 조항은{' '}
              <Text
                onPress={() => Linking.openURL(`${getWebBaseUrl()}/terms`)}
                style={{ color: tc.ink2, textDecorationLine: 'underline' }}
              >
                이용약관 제7조의2
              </Text>
              에서 확인할 수 있습니다.
            </Text>
            <Pressable
              onPress={() => setChecked((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16 }}
            >
              <View
                style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: tc.ink, marginTop: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? tc.ink : 'transparent' }}
              >
                {checked ? <Text style={{ color: tc.paper, fontSize: 13, fontWeight: '900', lineHeight: 16 }}>✓</Text> : null}
              </View>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: tc.ink, lineHeight: 19 }}>{UGC_AGREE_LABEL}</Text>
            </Pressable>
            {err ? <Text style={{ color: tc.red, fontSize: 12, marginTop: 8 }}>{err}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => finish(false)}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: tc.pap3, backgroundColor: tc.pap2, alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '800', fontSize: 14, color: tc.ink2 }}>취소</Text>
              </Pressable>
              <Pressable
                onPress={agree}
                disabled={!checked || busy}
                style={{ flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: tc.ink, alignItems: 'center', opacity: !checked || busy ? 0.45 : 1 }}
              >
                <Text style={{ fontWeight: '900', fontSize: 14, color: tc.paper }}>{busy ? '처리 중…' : '동의하고 계속하기'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
