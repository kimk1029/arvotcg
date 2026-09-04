'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useInventory } from '@/components/InventoryProvider';
import { ensureUgcTerms } from '@/components/UgcTermsGate';
import { TradeImagePicker } from '@/components/TradeImagePicker';
import { REWARDS } from '@/lib/rewards';
import { AppBar } from '@/components/ui/AppBar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatusBar } from '@/components/ui/StatusBar';
import { TextInput } from '@/components/ui/TextInput';
import { TradeTypeButton } from '@/components/ui/TradeTypeButton';
import { startRouteTransition } from '@/components/RouteProgress';
import { DEFAULT_FEED_CATEGORY, FEED_CATEGORIES, type FeedCategory } from '@/lib/feedCategories';
import type { Place, TradeType } from '@/lib/types';

export type WriteMode = 'feed' | 'trade';

const TITLES: Record<WriteMode, string> = {
  feed: '커뮤니티 글 작성',
  trade: '거래글 작성',
};

interface Props {
  mode: WriteMode;
  places?: Place[];
  prefill?: { title?: string; body?: string };
}

async function postJson(path: string, body: unknown) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

export function WriteScreen({ mode, places = [], prefill }: Props) {
  const router = useRouter();
  const { avatar: avatarId } = useInventory();
  // 만남 장소 UI 는 제거됨. 백엔드가 placeId(필수)를 요구하므로 첫 장소를 기본값으로 전송.
  const [place] = useState<string>(mode === 'trade' ? (places[0]?.id ?? '') : '');
  const [ttype, setTtype] = useState<TradeType>(
    prefill?.title?.startsWith('[판매]') ? 'sell' : 'buy',
  );
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [price, setPrice] = useState('');
  const [kakaoId, setKakaoId] = useState('');
  const [note, setNote] = useState(prefill?.body ?? '');
  const [category, setCategory] = useState<FeedCategory>(
    prefill?.body?.includes('자랑') ? '자랑' : DEFAULT_FEED_CATEGORY,
  );
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitLockRef = useRef(false);

  const isFeed = mode === 'feed';

  const submit = async () => {
    if (pending || submitLockRef.current) return;
    if (mode === 'trade') {
      if (!title.trim()) return setError('제목을 입력해주세요');
    }
    if (isFeed) {
      if (!note.trim()) return setError('내용을 입력해주세요');
    }
    setError(null);
    submitLockRef.current = true;
    // 커뮤니티 이용규칙(UGC EULA) 동의 — 미동의면 게이트 모달, 취소 시 등록 중단.
    if (!(await ensureUgcTerms())) {
      submitLockRef.current = false;
      return;
    }

    if (mode === 'trade') {
      startTransition(async () => {
        try {
          await postJson('/api/trades', {
            placeId: place,
            type: ttype,
            title,
            body: note,
            price,
            kakaoId: kakaoId || undefined,
            avatarId,
            images: images.length > 0 ? images : undefined,
          });
          startRouteTransition();
          router.push('/trade');
        } catch (e) {
          submitLockRef.current = false;
          setError(e instanceof Error ? e.message : '거래글 등록 실패');
        }
      });
      return;
    }

    startTransition(async () => {
      try {
        await postJson('/api/feeds', {
          text: note,
          avatarId,
          category,
          images: images.length > 0 ? images : undefined,
        });
        startRouteTransition();
        router.push('/feed');
      } catch (e) {
        submitLockRef.current = false;
        setError(e instanceof Error ? e.message : '등록 실패');
      }
    });
  };

  const submitLabel = mode === 'trade' ? '거래글 등록' : '글 올리기';

  return (
    <>
      <StatusBar />
      <AppBar title={TITLES[mode]} showBack />
      <div style={{ height: 14 }} />

      {mode === 'trade' && (
        <div className="form-sect">
          <div className="form-label">
            📦 유형 <span className="req">*</span>
          </div>
          <div className="trade-type-grid">
            <TradeTypeButton variant="buy" active={ttype === 'buy'} onClick={() => setTtype('buy')}>
              💙 삽니다
            </TradeTypeButton>
            <TradeTypeButton variant="sell" active={ttype === 'sell'} onClick={() => setTtype('sell')}>
              ❤️ 팝니다
            </TradeTypeButton>
          </div>
        </div>
      )}

      {mode === 'trade' && (
        <>
          <div className="form-sect">
            <div className="form-label">
              📝 제목 <span className="req">*</span>
            </div>
            <TextInput
              placeholder="거래 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-sect">
            <div className="form-label">💰 가격</div>
            <TextInput
              placeholder="예) 15,000 / 정가 / 협의"
              value={price}
              onChange={(e) => {
                const raw = e.target.value;
                const digitsOnly = raw.replace(/,/g, '');
                if (/^\d+$/.test(digitsOnly)) {
                  setPrice(Number(digitsOnly).toLocaleString('ko-KR'));
                } else {
                  setPrice(raw);
                }
              }}
              inputMode="numeric"
            />
          </div>
          <div className="form-sect">
            <div className="form-label">
              💬 카카오톡 ID / 오픈채팅 링크{' '}
              <span style={{ fontSize: 11, opacity: 0.6 }}>(선택)</span>
            </div>
            <TextInput
              placeholder="예) kakao_id 또는 https://open.kakao.com/o/..."
              value={kakaoId}
              onChange={(e) => setKakaoId(e.target.value)}
            />
          </div>
          <div className="form-sect">
            <div className="form-label">
              📷 상품 사진 <span style={{ fontSize: 11, opacity: 0.6 }}>(선택)</span>
            </div>
            <TradeImagePicker value={images} onChange={setImages} max={5} />
          </div>
        </>
      )}

      {isFeed && (
        <div className="form-sect">
          <div className="form-label">🏷 카테고리</div>
          {/* 카테고리가 4개라 좁은 화면에서는 두 줄로 접힌다 (라벨 잘림 방지). */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FEED_CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  style={{
                    flex: '1 1 20%',
                    minWidth: 72,
                    whiteSpace: 'nowrap',
                    padding: '10px 0',
                    fontFamily: 'var(--f2)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: on ? 'var(--ink)' : 'var(--white)',
                    color: on ? 'var(--white)' : 'var(--ink2)',
                    border: '2px solid var(--ink)',
                    borderRadius: 'var(--r-sm, 0)',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="form-sect">
        <div className="form-label">
          {mode === 'trade' ? '📄 내용' : '🗣 하고 싶은 말'}
        </div>
        <TextInput
          placeholder={mode === 'trade' ? '거래 관련 상세 내용' : '자유롭게 입력하세요'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {isFeed && (
        <div className="form-sect">
          <div className="form-label">
            📷 사진 첨부 <span style={{ fontSize: 11, opacity: 0.6 }}>(선택, 최대 3장 · 펼쳐야 보임)</span>
          </div>
          <TradeImagePicker
            value={images}
            onChange={setImages}
            max={3}
            endpoint="/api/upload/feed-images"
          />
        </div>
      )}

      {error && (
        <div
          className="form-sect"
          style={{ color: 'var(--red)', fontFamily: 'var(--f2)', fontSize: 17 }}
        >
          ⚠ {error}
        </div>
      )}

      <div
        style={{
          margin: '0 var(--gap) 6px',
          padding: '8px 12px',
          background: 'var(--pap2)',
          fontFamily: 'var(--f1)',
          fontSize: 9,
          color: 'var(--ink2)',
          letterSpacing: 0.3,
          lineHeight: 1.6,
          textAlign: 'center',
          boxShadow:
            '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
        }}
      >
        🪙 작성 시 +
        {mode === 'trade' ? REWARDS.trade_post : REWARDS.feed_general}P 지급
        {mode === 'trade' && <> · 거래 완료 시 +{REWARDS.trade_done}P</>}
      </div>

      <PrimaryButton onClick={submit} disabled={pending}>
        {pending ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span
              aria-hidden
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '2px solid var(--ink)',
                background: `linear-gradient(to bottom,
                  var(--red) 0,var(--red) 46%,
                  var(--ink) 46%,var(--ink) 54%,
                  var(--white) 54%,var(--white) 100%)`,
                position: 'relative',
                animation: 'pf-ball-spin 0.7s linear infinite',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--white)',
                  border: '1.5px solid var(--ink)',
                  transform: 'translate(-50%,-50%)',
                }}
              />
            </span>
            등록 중...
          </span>
        ) : (
          `▶ ${submitLabel} ▶`
        )}
      </PrimaryButton>
    </>
  );
}
