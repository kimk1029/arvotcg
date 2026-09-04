'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { SHOP_TEMPLATE_JSON, SHOP_TEMPLATE_FIELDS } from '@/lib/shops';

/**
 * 카드샵 JSON 가져오기 / 양식 내려받기.
 *
 * 양식(SHOP_TEMPLATE_JSON)은 실제 등록 API 가 받는 필드 그대로다 — 양식을 채워
 * 그대로 올리면 된다. 검증은 서버(POST /api/shops/import)가 단건 등록과 같은
 * parseShopInput 으로 하고, 한 줄이라도 틀리면 아무것도 저장하지 않는다.
 */
export function ShopImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const downloadTemplate = () => {
    const blob = new Blob([SHOP_TEMPLATE_JSON], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arvotcg-cardshops-template.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('JSON 형식이 아닙니다 — 양식을 내려받아 확인해주세요');
      }
      const shops = Array.isArray(payload) ? payload : (payload as { shops?: unknown }).shops;
      if (!Array.isArray(shops)) throw new Error('최상위가 배열이거나 { "shops": [...] } 형태여야 합니다');
      if (mode === 'replace' && !confirm(`기존 카드샵을 모두 지우고 ${shops.length}개로 교체합니다. 계속할까요?`)) {
        return;
      }
      const res = await fetch('/api/shops/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shops, mode }),
      });
      const body = (await res.json().catch(() => ({}))) as { created?: number; updated?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMsg({
        type: 'ok',
        text: `가져오기 완료 — 추가 ${body.created ?? 0}개 · 갱신 ${body.updated ?? 0}개 (웹/앱 카드샵에 바로 반영)`,
      });
      router.refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '가져오기 실패' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <h2>JSON 일괄 등록</h2>
      <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7, margin: '6px 0 12px' }}>
        양식을 내려받아 채운 뒤 그대로 올리면 됩니다. 필수는 <b>name</b>·<b>addr</b> 둘뿐이고,
        나머지는 비워도 기본값이 들어갑니다. 좌표(lat/lng)를 비우면 지도가 주소를 지오코딩해 핀을 찍습니다.
        한 항목이라도 형식이 틀리면 <b>아무것도 저장하지 않고</b> 몇 번째가 왜 틀렸는지 알려줍니다.
      </p>

      {msg && (
        <div
          style={{
            padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12,
            background: msg.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
            color: msg.type === 'ok' ? '#047857' : '#B91C1C',
          }}
        >
          {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={downloadTemplate} style={ghostBtn}>
          ⬇ 기본 양식 다운로드 (.json)
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={primaryBtn}>
          {busy ? '가져오는 중…' : '⬆ JSON 파일 가져오기'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <label style={radioLabel}>
          <input type="radio" name="importMode" checked={mode === 'append'} onChange={() => setMode('append')} />
          추가/갱신 (이름+주소가 같으면 덮어쓰기)
        </label>
        <label style={radioLabel}>
          <input type="radio" name="importMode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
          전체 교체 (기존 삭제)
        </label>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: 12, color: '#475569', cursor: 'pointer' }}>필드 설명 보기</summary>
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead>
            <tr><th>필드</th><th>설명</th></tr>
          </thead>
          <tbody>
            {SHOP_TEMPLATE_FIELDS.map((f) => (
              <tr key={f.key}>
                <td className="mono">{f.key}{f.required ? ' *' : ''}</td>
                <td style={{ fontSize: 12 }}>{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#fff',
  background: '#3B82F6', border: 'none', borderRadius: 6, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#1E293B',
  background: '#fff', border: '1px solid #CBD5E1', borderRadius: 6, cursor: 'pointer',
};
const radioLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', cursor: 'pointer',
};
