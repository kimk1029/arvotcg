import Link from 'next/link';

/** 필터 칩 — 행동 로그·방문 기록 공용. */
export function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        border: '1px solid #CBD5E1',
        borderRadius: 5,
        background: on ? '#3B82F6' : '#fff',
        color: on ? '#fff' : '#334155',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Link>
  );
}

export function Pager({
  mkHref, page, totalPages,
}: { mkHref: (over: { page: string }) => string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pager">
      {page > 1 ? <Link href={mkHref({ page: String(page - 1) })}>← 이전</Link> : <span className="disabled">← 이전</span>}
      <span className="disabled">{page} / {totalPages}</span>
      {page < totalPages ? <Link href={mkHref({ page: String(page + 1) })}>다음 →</Link> : <span className="disabled">다음 →</span>}
    </div>
  );
}
