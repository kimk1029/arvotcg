import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.arvotcg.com';

/** 로그인 필수 콘텐츠의 ID/목록을 공개 sitemap으로 노출하지 않는다. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/privacy', '/terms', '/account-deletion'].map(path => ({
    url: `${SITE_URL}${path}`, changeFrequency: 'monthly', priority: 0.3,
  }));
}
