'use client';

import { useRef, useState } from 'react';
import { useInventory } from '@/components/InventoryProvider';
import { PixelBackground } from '@/components/PixelBackground';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useToast } from '@/components/ToastProvider';
import { AppBar } from '@/components/ui/AppBar';
import { LivePill } from '@/components/ui/LivePill';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Segmented } from '@/components/ui/Segmented';
import { StatusBar } from '@/components/ui/StatusBar';
import { AVATARS, type AvatarId } from '@/lib/avatars';
import { REWARDS } from '@/lib/rewards';
import { BACKGROUNDS, FRAMES, type BackgroundId, type FrameId } from '@/lib/shop';

type Tab = 'avatar' | 'bg' | 'frame';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'avatar', label: '아바타' },
  { id: 'bg',     label: '배경' },
  { id: 'frame',  label: '테두리' },
];

export function ShopScreen() {
  const inv = useInventory();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('avatar');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showPointHelp, setShowPointHelp] = useState(false);
  const pendingRef = useRef(false);

  const beginPending = (id: string): boolean => {
    if (pendingRef.current || pendingId) return false;
    pendingRef.current = true;
    setPendingId(id);
    return true;
  };

  const endPending = () => {
    pendingRef.current = false;
    setPendingId(null);
  };

  const buyAvatar = async (id: AvatarId, price: number) => {
    if (!beginPending(id)) return;
    try {
      if (inv.avatarOwned.includes(id)) {
        const r = await inv.pickAvatar(id);
        r.ok ? toast.success(`${id} 선택`) : toast.error(r.msg ?? '실패');
      } else {
        const r = await inv.buyAvatar(id, price);
        r.ok ? toast.success('획득!') : toast.error(r.msg ?? '실패');
      }
    } finally {
      endPending();
    }
  };
  const buyBg = async (id: BackgroundId, price: number) => {
    if (!beginPending(id)) return;
    try {
      const r = await inv.buyBg(id, price);
      r.ok ? toast.success('적용!') : toast.error(r.msg ?? '실패');
    } finally {
      endPending();
    }
  };
  const buyFrame = async (id: FrameId, price: number) => {
    if (!beginPending(id)) return;
    try {
      const r = await inv.buyFrame(id, price);
      r.ok ? toast.success('적용!') : toast.error(r.msg ?? '실패');
    } finally {
      endPending();
    }
  };
  return (
    <>
      <StatusBar />
      <AppBar
        title="꾸미기 샵"
        showBack
        right={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LivePill label={`${inv.points.toLocaleString()}P`} />
            <button
              type="button"
              aria-label="포인트 적립 안내"
              title="포인트 적립 안내"
              onClick={() => setShowPointHelp(true)}
              style={{
                width: 24,
                height: 24,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--white)',
                color: 'var(--ink)',
                fontFamily: 'var(--f1)',
                fontSize: 13,
                lineHeight: 1,
                boxShadow:
                  '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),2px 2px 0 var(--ink)',
              }}
            >
              ?
            </button>
          </div>
        }
      />

      <div style={{ height: 14 }} />
      <Segmented items={TABS} value={tab} onChange={setTab} />

      {tab === 'avatar' && (
        <div className="sect">
          <SectionTitle title="아바타" right={<span className="more">총 {AVATARS.length}종</span>} />
          <div className="shop-avatar-grid">
            {AVATARS.map((a) => {
              const owned = inv.avatarOwned.includes(a.id);
              const current = inv.avatar === a.id;
              const levelLocked = a.mode === 'level' && !owned;
              return (
                <div key={a.id} className={`shop-avatar-card${current ? ' on' : ''}`}>
                  <div className="sac-img"><ProfileAvatar id={a.id} size={60} /></div>
                  <div className="sac-name">{a.name}</div>
                  {a.tag && <div className={`sac-tag tag-${a.tag}`}>{a.tag.toUpperCase()}</div>}
                  <button
                    type="button"
                    className={`sac-btn ${owned ? 'owned' : ''} ${levelLocked ? 'locked' : ''}`}
                    disabled={!!pendingId || levelLocked}
                    onClick={() => buyAvatar(a.id, a.price ?? 0)}
                  >
                    {pendingId === a.id
                      ? '...'
                      : owned
                        ? current ? '선택됨' : '선택'
                        : levelLocked
                          ? `🔒 LV.${a.level}`
                          : a.mode === 'shop'
                            ? `🪙 ${(a.price ?? 0).toLocaleString()}`
                            : '획득'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'bg' && (
        <div className="sect">
          <SectionTitle title="배경" right={<span className="more">총 {BACKGROUNDS.length}종</span>} />
          <div className="shop-avatar-grid">
            {BACKGROUNDS.map((b) => {
              const owned = inv.bgOwned.includes(b.id);
              const current = inv.bg === b.id;
              return (
                <div key={b.id} className={`shop-avatar-card${current ? ' on' : ''}`}>
                  <div className="sac-img" style={{ position: 'relative', width: 72, height: 48, overflow: 'hidden' }}>
                    <PixelBackground id={b.id} />
                  </div>
                  <div className="sac-name">{b.name}</div>
                  {b.tag && <div className={`sac-tag tag-${b.tag}`}>{b.tag.toUpperCase()}</div>}
                  <button
                    type="button"
                    className={`sac-btn ${owned ? 'owned' : ''}`}
                    disabled={!!pendingId}
                    onClick={() => buyBg(b.id, b.price)}
                  >
                    {pendingId === b.id ? '...' : owned ? (current ? '선택됨' : '선택') : `🪙 ${b.price.toLocaleString()}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'frame' && (
        <div className="sect">
          <SectionTitle title="테두리" right={<span className="more">총 {FRAMES.length}종</span>} />
          <div className="shop-avatar-grid">
            {FRAMES.map((f) => {
              const owned = inv.frameOwned.includes(f.id);
              const current = inv.frame === f.id;
              return (
                <div key={f.id} className={`shop-avatar-card${current ? ' on' : ''}`}>
                  <div className={`sac-img frm-${f.id}`} style={{ width: 64, height: 64, background: 'var(--pap2)' }}>
                    <ProfileAvatar id="bulbasaur" size={44} />
                  </div>
                  <div className="sac-name">{f.name}</div>
                  {f.tag && <div className={`sac-tag tag-${f.tag}`}>{f.tag.toUpperCase()}</div>}
                  <button
                    type="button"
                    className={`sac-btn ${owned ? 'owned' : ''}`}
                    disabled={!!pendingId}
                    onClick={() => buyFrame(f.id, f.price)}
                  >
                    {pendingId === f.id ? '...' : owned ? (current ? '선택됨' : '선택') : `🪙 ${f.price.toLocaleString()}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showPointHelp && <PointHelpModal onClose={() => setShowPointHelp(false)} />}

      <div className="bggap" />
    </>
  );
}

function PointHelpModal({ onClose }: { onClose: () => void }) {
  const rows = [
    { label: '하루 1회 출석', points: REWARDS.login_daily },
    { label: '3일 연속 출석 보너스', points: REWARDS.login_streak3_bonus },
    { label: '커뮤니티 글 작성', points: REWARDS.feed_general },
    { label: '거래글 등록', points: REWARDS.trade_post },
    { label: '거래 완료 처리', points: REWARDS.trade_done },
  ];

  return (
    <div className="avatar-overlay" onClick={onClose}>
      <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-modal-head">
          <span>포인트 적립 안내</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="avatar-close">
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 8,
            marginTop: 12,
          }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--white)',
                fontFamily: 'var(--f1)',
                fontSize: 10,
                lineHeight: 1.5,
                boxShadow:
                  '-2px 0 0 var(--ink),2px 0 0 var(--ink),0 -2px 0 var(--ink),0 2px 0 var(--ink),3px 3px 0 var(--ink)',
              }}
            >
              <span>{row.label}</span>
              <span style={{ color: 'var(--red)', whiteSpace: 'nowrap' }}>
                +{row.points.toLocaleString()}P
              </span>
            </div>
          ))}
        </div>

        <div
          className="avatar-modal-hint"
          style={{ marginTop: 14, lineHeight: 1.8 }}
        >
          유료 충전과 무료 광고 충전은 현재 운영하지 않습니다.
        </div>
      </div>
    </div>
  );
}
