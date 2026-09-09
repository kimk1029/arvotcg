/**
 * 수익 인증(자랑하기) 공유 — 내 컬렉션 카드 한 장의 등록가 대비 현재 시세를
 * 포스터 형태로 보여주는 공개 페이지(웹 /flex/:token)의 데이터 소스.
 *
 * 링크는 카드 id 만으로는 열 수 없고, 서버 비밀키로 만든 짧은 서명이 붙어야 한다
 * (남의 카드 id 를 넣어 훑는 것 방지). 서명 발급은 로그인한 소유자만(POST /api/me/flex-link).
 */
import { Router, type Request, type Response } from 'express';
import { createHmac } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { registerBasisJpy } from '../../shared/snkrdunkPrice';
import { loadCatalogEntries, refreshApparelPrices } from '../lib/snkrdunkCatalog.js';
import { translateKnownCardNameToKo } from '../../shared/cardTranslate';
import { parseCardStatics } from '../../shared/cardStatics';
import { getCardPackMeta } from '@/lib/cardPacks';

const router = Router();

const SECRET = process.env.JWT_SECRET ?? 'flex-dev-secret';

/** 카드 id → 공유 토큰 `{id}.{sig}`. 서명 8자면 추측이 사실상 불가능하다. */
export function flexToken(cardId: number): string {
  const sig = createHmac('sha256', SECRET).update(`flex:${cardId}`).digest('base64url').slice(0, 10);
  return `${cardId}.${sig}`;
}

function parseFlexToken(token: string): number | null {
  const [idStr, sig] = token.split('.');
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0 || !sig) return null;
  return flexToken(id) === token ? id : null;
}

router.get('/:token', async (req: Request, res: Response) => {
  const id = parseFlexToken(String(req.params.token));
  if (id == null) return res.status(404).json({ error: 'not found' });
  try {
    const card = await prisma.userCard.findUnique({
      where: { id },
      select: {
        id: true, snkrdunkApparelId: true, nickname: true, photoUrl: true, qty: true,
        region: true, graded: true, gradeCompany: true, gradeValue: true,
        registerPriceJpy: true, buyPrice: true, buyCurrency: true, createdAt: true,
        ocrSetCode: true, ocrCardNumber: true,
        user: { select: { name: true, avatarId: true, backgroundId: true, frameId: true } },
      },
    });
    if (!card) return res.status(404).json({ error: 'not found' });

    // 시세 — 카탈로그 스냅샷 우선, 없으면 라이브 1회.
    let name: string | null = null;
    let imageUrl: string | null = null;
    let setCode: string | null = null;
    let cardNumber: string | null = null;
    let rarity: string | null = null;
    let series: string | null = null;
    let minPriceJpy = 0;
    let prices = { single: 0, psa10: 0, psa9: 0, psa8: 0 };
    if (card.snkrdunkApparelId != null) {
      const cat = await loadCatalogEntries([card.snkrdunkApparelId]);
      const e = cat.get(card.snkrdunkApparelId);
      if (e) {
        name = e.name;
        imageUrl = e.imageUrl;
        setCode = e.setCode ?? null;
        series = e.packCode ? getCardPackMeta(e.packCode)?.shortName ?? null : null;
        if (e.snapshot) {
          prices = {
            single: e.snapshot.priceSingle,
            psa10: e.snapshot.pricePsa10,
            psa9: e.snapshot.pricePsa9,
            psa8: e.snapshot.pricePsa8,
          };
          minPriceJpy = e.snapshot.minPrice ?? 0;
        }
      }
      if (prices.single <= 0 && prices.psa10 <= 0) {
        const r = await refreshApparelPrices(card.snkrdunkApparelId).catch(() => null);
        if (r) {
          name = name ?? r.name;
          imageUrl = imageUrl ?? r.imageUrl;
          prices = { single: r.single, psa10: r.psa10, psa9: r.psa9, psa8: r.psa8 };
        }
      }
    }
    const koName = name ? translateKnownCardNameToKo(name) : card.nickname;
    const statics = parseCardStatics(name ?? koName ?? '');
    setCode = setCode ?? statics.setCode ?? card.ocrSetCode;
    cardNumber = statics.cardNumber ?? card.ocrCardNumber;
    rarity = statics.rarity ?? null;

    const basis = registerBasisJpy(
      { ...prices, trendJpy: [] },
      { graded: card.graded, gradeCompany: card.gradeCompany, gradeValue: card.gradeValue },
    );

    res.json({
      data: {
        name: koName ?? '이름 미상',
        nameJa: name,
        imageUrl: imageUrl ?? card.photoUrl,
        setCode,
        cardNumber,
        rarity,
        series,
        region: card.region ?? 'jp',
        graded: card.graded,
        gradeCompany: card.gradeCompany,
        gradeValue: card.gradeValue,
        qty: Math.max(1, card.qty || 1),
        registerPriceJpy: card.registerPriceJpy ?? null,
        currentPriceJpy: basis.price,
        priceBasis: basis.basis,
        minPriceJpy,
        createdAt: card.createdAt.toISOString(),
        owner: {
          name: card.user?.name ?? '컬렉터',
          avatarId: card.user?.avatarId ?? 'bulbasaur',
          backgroundId: card.user?.backgroundId ?? 'default',
          frameId: card.user?.frameId ?? 'none',
        },
      },
    });
  } catch (err) {
    console.error('[flex.GET]', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
