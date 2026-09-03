/**
 * 커뮤니티 인기글 랭킹 — 웹·앱 공통 정본.
 *
 * 서버엔 조회수/인기 정렬이 없으므로(feed 는 createdAt 정렬만) 클라이언트가 이미 받은
 * 목록(최신 20건)에서 좋아요(북마크)·댓글 수로 뽑는다.
 *  - 불타는 글(hot): 좋아요×2 + 댓글 수 점수 → 동점이면 최신.
 *  - 개념글(best): 좋아요 수 → 댓글 수 → 최신.
 * 커뮤니티 정렬 '인기순' 도 같은 hot 점수를 쓴다.
 */
export interface RankableFeedPost {
  id: number;
  text: string;
  createdAt: string;
  likeCount?: number | null;
  commentCount?: number | null;
}

export function feedHotScore(p: RankableFeedPost): number {
  return (p.likeCount ?? 0) * 2 + (p.commentCount ?? 0);
}

function byRecent(a: RankableFeedPost, b: RankableFeedPost): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

/** 불타는 글 상위 n — 점수 desc, 동점 최신순. 글이 n개 미만이면 있는 만큼. */
export function rankHotPosts<T extends RankableFeedPost>(posts: readonly T[], n = 3): T[] {
  return [...posts]
    .sort((a, b) => feedHotScore(b) - feedHotScore(a) || byRecent(a, b))
    .slice(0, n);
}

/** 개념글 상위 n — 좋아요 desc → 댓글 desc → 최신순. */
export function rankBestPosts<T extends RankableFeedPost>(posts: readonly T[], n = 3): T[] {
  return [...posts]
    .sort(
      (a, b) =>
        (b.likeCount ?? 0) - (a.likeCount ?? 0) ||
        (b.commentCount ?? 0) - (a.commentCount ?? 0) ||
        byRecent(a, b),
    )
    .slice(0, n);
}

/** 인기글 행 제목 — 본문 첫 줄(공백 정리)을 max 자로 자른다. */
export function feedPostTitle(text: string | null | undefined, max = 48): string {
  const first = (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? '';
  if (!first) return '(내용 없음)';
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

/** 1234 → '1,234' (인기글 카운트 표기). */
export function formatCount(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-US');
}
