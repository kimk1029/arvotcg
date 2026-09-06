'use client';

import { useEffect, useState } from 'react';
import { PLATFORM_LABEL, PROVIDER_LABEL, resolveSignupProvider } from '@/lib/signupProvider';

/** "iOS · 카카오" 형태. SNS 기록이 없으면 UID 패턴 추정에 "(추정)" 표시. */
function signupLabel(platform: string | null, provider: string | null, userId: string): string {
  const [p, inferred] = resolveSignupProvider(provider, userId);
  const plat = platform ? (PLATFORM_LABEL[platform] ?? platform) : userId.startsWith('apple_') ? 'iOS' : '미상';
  const sns = p ? `${PROVIDER_LABEL[p]}${inferred ? '(추정)' : ''}` : '-';
  return `${plat} · ${sns}`;
}

interface SpendItem {
  kind: 'oripa' | 'avatar' | 'background' | 'frame';
  label: string;
  amount: number;
  at: string | null;
  ref?: string;
}

interface UserDetail {
  user: {
    id: string; name: string; email: string | null; avatar: string; avatarId: string;
    signupPlatform: string | null; signupProvider: string | null;
    backgroundId: string; frameId: string; rating: number; points: number;
    ownedAvatars: string[]; ownedBackgrounds: string[]; ownedFrames: string[];
    createdAt: string; updatedAt: string;
    _count: {
      feeds: number; trades: number; bookmarks: number;
      sentMessages: number; receivedMessages: number; oripaTickets: number;
      userCards: number; favoriteCards: number; searchLogs: number;
    };
  };
  feeds: Array<{ id: number; text: string; createdAt: string }>;
  trades: Array<{ id: number; type: string; status: string; title: string; price: string | null; createdAt: string }>;
  pulls: Array<{ id: number; packId: string; index: number; grade: string | null; prizeName: string | null; drawnAt: string | null }>;
  lastViews: Array<{ id: number; path: string; ip: string | null; country: string | null; createdAt: string }>;
  userCards: Array<{
    id: number; cardId: string | null; nickname: string | null; memo: string | null;
    ocrSetCode: string | null; ocrCardNumber: string | null; snkrdunkApparelId: number | null;
    gradeEstimate: string | null; centeringScore: number | null; photoUrl: string | null; createdAt: string;
  }>;
  spending: SpendItem[];
  totalSpent: number;
  oripaSpent: number;
  inventorySpent: number;
}

const SPEND_KIND_LABEL: Record<SpendItem['kind'], string> = {
  oripa: '오리파',
  avatar: '아바타',
  background: '배경',
  frame: '테두리',
};

function fmt(d: string | null | undefined): string {
  if (!d) return '-';
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

interface Props {
  userId: string;
  onClose: () => void;
}

export function UserDetailModal({ userId, onClose }: Props) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) setData(d as UserDetail); })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 999,
        display: 'grid', placeItems: 'center', padding: 20, overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 10, width: 'min(1100px,100%)', maxHeight: '90vh',
          overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,.25)',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{data?.user.name ?? '로딩 중…'}</div>
            <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}>
              {data?.user.id ?? userId}
            </div>
          </div>
          <button onClick={onClose} className="btn" aria-label="닫기">✕</button>
        </header>

        <div style={{ padding: 20 }}>
          {err && <div style={{ color: '#B91C1C', fontSize: 12 }}>⚠ {err}</div>}
          {!data ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>불러오는 중…</div>
          ) : (
            <>
              <div className="grid-stats">
                <Stat label="포인트 잔액" value={data.user.points} />
                <Stat label="총 사용(추정)" value={data.totalSpent} />
                <Stat label="오리파 사용" value={data.oripaSpent} />
                <Stat label="아이템 사용" value={data.inventorySpent} />
                <Stat label="컬렉션 카드" value={data.user._count.userCards} />
                <Stat label="관심 카드" value={data.user._count.favoriteCards} />
                <Stat label="검색 수" value={data.user._count.searchLogs} />
                <Stat label="피드" value={data.user._count.feeds} />
                <Stat label="거래" value={data.user._count.trades} />
                <Stat label="찜" value={data.user._count.bookmarks} />
                <Stat label="쪽지" value={data.user._count.sentMessages + data.user._count.receivedMessages} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginTop: 16 }}>
                <Card title="프로필">
                  <table className="tbl">
                    <tbody>
                      <Row k="이름" v={data.user.name} />
                      <Row k="이메일" v={data.user.email ?? '-'} />
                      <Row k="UID" v={data.user.id} />
                      <Row k="가입 경로" v={signupLabel(data.user.signupPlatform, data.user.signupProvider, data.user.id)} />
                      <Row k="아바타" v={`${data.user.avatar} / ${data.user.avatarId}`} />
                      <Row k="배경" v={data.user.backgroundId} />
                      <Row k="프레임" v={data.user.frameId} />
                      <Row k="평점" v={`${data.user.rating} / 5`} />
                      <Row k="가입" v={fmt(data.user.createdAt)} />
                      <Row k="업데이트" v={fmt(data.user.updatedAt)} />
                      <Row k="보유 아바타" v={data.user.ownedAvatars.join(', ') || '-'} />
                      <Row k="보유 배경" v={data.user.ownedBackgrounds.join(', ') || '-'} />
                      <Row k="보유 프레임" v={data.user.ownedFrames.join(', ') || '-'} />
                    </tbody>
                  </table>
                </Card>

                <Card title={`내 컬렉션 카드 (${data.userCards.length})`}>
                  {data.userCards.length === 0 ? <div className="muted">없음</div> : (
                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                      <table className="tbl">
                        <thead><tr><th>사진</th><th>카드</th><th>등급</th><th>중심도</th><th>시세ID</th><th>등록</th></tr></thead>
                        <tbody>
                          {data.userCards.map((c) => (
                            <tr key={c.id}>
                              <td>
                                {c.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={c.photoUrl} alt="" style={{ width: 28, height: 38, objectFit: 'cover', borderRadius: 3, display: 'block' }} />
                                ) : <span className="muted">-</span>}
                              </td>
                              <td title={c.memo ?? ''}>
                                {c.nickname || c.cardId
                                  || (c.ocrSetCode || c.ocrCardNumber ? `${c.ocrSetCode ?? ''} ${c.ocrCardNumber ?? ''}`.trim() : null)
                                  || <span className="muted">미매칭</span>}
                              </td>
                              <td className="mono">{c.gradeEstimate ?? '-'}</td>
                              <td className="mono">{c.centeringScore != null ? c.centeringScore.toFixed(0) : '-'}</td>
                              <td className="mono muted">{c.snkrdunkApparelId ?? '-'}</td>
                              <td className="mono muted">{fmt(c.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card title="최근 피드 (10)">
                  {data.feeds.length === 0 ? <div className="muted">없음</div> : (
                    <table className="tbl">
                      <thead><tr><th>#</th><th>본문</th><th>시각</th></tr></thead>
                      <tbody>
                        {data.feeds.map((f) => (
                          <tr key={f.id}>
                            <td className="mono">{f.id}</td>
                            <td>{trunc(f.text, 40)}</td>
                            <td className="mono muted">{fmt(f.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                <Card title="최근 거래 (10)">
                  {data.trades.length === 0 ? <div className="muted">없음</div> : (
                    <table className="tbl">
                      <thead><tr><th>#</th><th>유형</th><th>상태</th><th>제목</th><th>가격</th><th>시각</th></tr></thead>
                      <tbody>
                        {data.trades.map((t) => (
                          <tr key={t.id}>
                            <td className="mono">{t.id}</td>
                            <td><span className="tag">{t.type}</span></td>
                            <td><span className={`tag ${t.status === 'done' ? 'tag-done' : 'tag-open'}`}>{t.status}</span></td>
                            <td>{trunc(t.title, 40)}</td>
                            <td className="mono">{t.price ?? '-'}</td>
                            <td className="mono muted">{fmt(t.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                <Card title={`포인트 사용 내역 (${data.spending.length})`}>
                  {data.spending.length === 0 ? (
                    <div className="muted">사용 내역 없음</div>
                  ) : (
                    <>
                      <div className="muted" style={{ marginBottom: 8, fontSize: 11 }}>
                        오리파 뽑기는 실제 시각, 보유 아이템은 가격 기준 추정 (시각 미기록).
                      </div>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>분류</th>
                            <th>항목</th>
                            <th style={{ textAlign: 'right' }}>포인트</th>
                            <th>시각</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.spending.map((s, i) => (
                            <tr key={`${s.kind}-${s.ref ?? i}-${i}`}>
                              <td>
                                <span className="tag">{SPEND_KIND_LABEL[s.kind]}</span>
                              </td>
                              <td>{trunc(s.label, 50)}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>
                                -{s.amount.toLocaleString()}
                              </td>
                              <td className="mono muted">
                                {s.at ? fmt(s.at) : <span className="muted">미기록</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </Card>

                <Card title="오리파 뽑기 (10)">
                  {data.pulls.length === 0 ? <div className="muted">없음</div> : (
                    <table className="tbl">
                      <thead><tr><th>팩</th><th>#</th><th>등급</th><th>상품</th><th>시각</th></tr></thead>
                      <tbody>
                        {data.pulls.map((p) => (
                          <tr key={p.id}>
                            <td className="mono">{p.packId}</td>
                            <td className="mono">{p.index}</td>
                            <td className="mono">{p.grade ?? '-'}</td>
                            <td>{p.prizeName ?? '-'}</td>
                            <td className="mono muted">{fmt(p.drawnAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                <Card title="최근 방문 (10)">
                  {data.lastViews.length === 0 ? <div className="muted">없음</div> : (
                    <table className="tbl">
                      <thead><tr><th>경로</th><th>IP</th><th>국가</th><th>시각</th></tr></thead>
                      <tbody>
                        {data.lastViews.map((v) => (
                          <tr key={v.id}>
                            <td className="mono">{v.path}</td>
                            <td className="mono">{v.ip ?? '-'}</td>
                            <td className="mono">{v.country ?? '-'}</td>
                            <td className="mono muted">{fmt(v.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td style={{ width: 120, color: '#64748B' }}>{k}</td>
      <td className="mono">{v}</td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="lbl">{label}</div>
      <div className="val">{value.toLocaleString()}</div>
    </div>
  );
}
