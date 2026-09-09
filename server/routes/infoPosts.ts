import { Router } from 'express';
import type { InfoPostsPage } from '../../shared/infoPosts';

const router = Router();
const cache = new Map<number, { at: number; data: InfoPostsPage }>();
const pending = new Map<number, Promise<InfoPostsPage>>();

export function parseInfoPosts(text: string, page: number): InfoPostsPage {
  // 네이버 pagingHtml은 JSON 표준에 없는 작은따옴표 이스케이프를 포함한다.
  const body = JSON.parse(text.replace(/\\'/g, "'"));
  if (body.resultCode !== 'S' || !Array.isArray(body.postList)) throw new Error('Invalid blog response');
  const posts = body.postList.filter((p: Record<string, unknown>) =>
    String(p.categoryNo) === '7' && /^\d+$/.test(String(p.logNo)) &&
    p.openType === '2' && String(p.isPostBlocked) === '0' && p.isPostNotOpen === '0',
  ).map((p: Record<string, string>) => ({
    id: p.logNo,
    title: decodeURIComponent(p.title.replace(/\+/g, ' '))
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
    date: p.addDate,
    url: `https://m.blog.naver.com/kimk10200/${p.logNo}`,
  }));
  const total = Number(body.totalCount);
  return { posts, page, hasMore: page < 1000 && (Number.isFinite(total) ? page * 10 < total : body.postList.length === 10) };
}

router.get('/', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) {
    return res.status(400).json({ error: 'Invalid page' });
  }
  const cached = cache.get(page);
  if (cached && Date.now() - cached.at < 300_000) return res.json(cached.data);
  try {
    let task = pending.get(page);
    if (!task) {
      task = (async () => {
        const url = new URL('https://blog.naver.com/PostTitleListAsync.naver');
        url.search = new URLSearchParams({ blogId: 'kimk10200', categoryNo: '7', currentPage: String(page), countPerPage: '10' }).toString();
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(`Blog HTTP ${response.status}`);
        const data = parseInfoPosts(await response.text(), page);
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(page, { at: Date.now(), data });
        return data;
      })().finally(() => pending.delete(page));
      pending.set(page, task);
    }
    return res.json(await task);
  } catch {
    if (cached && Date.now() - cached.at < 3_600_000) return res.json(cached.data);
    return res.status(502).json({ error: '블로그 글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

export default router;
