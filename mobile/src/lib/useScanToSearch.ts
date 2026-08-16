/**
 * '촬영 → OCR(세트코드+번호) → 검색 목록' 플로우 훅 — 웹 HomeKoSearchBar 카메라 패리티.
 * 홈 검색 인풋 카메라와 카드 추가(직접입력) 우상단 카메라가 같은 훅을 쓴다.
 * 목록에서 카드 선택 → 시세상세 → '내 컬렉션에 추가'로 등록하는 흐름.
 */
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { uploadScanImage, CardScanError } from '@/services/cardScanApi';
import { useToast } from '@/components/ToastProvider';

export function useScanToSearch() {
  const toast = useToast();
  const [scanBusy, setScanBusy] = useState(false);

  const scanToSearch = async () => {
    if (scanBusy) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const result = perm.granted
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setScanBusy(true);
    try {
      const r = await uploadScanImage({
        uri: a.uri,
        guideRect: { x: 0, y: 0, w: a.width ?? 0, h: a.height ?? 0 },
        imageWidth: a.width ?? 0,
        imageHeight: a.height ?? 0,
        capturedAt: new Date().toISOString(),
        useAi: true,
        language: 'ko',
      });
      const setCode = (r.extracted?.setCode ?? '').trim();
      const num = (r.extracted?.cardNumber ?? '').split('/')[0].trim();
      const q = [setCode, num].filter(Boolean).join(' ');
      if (q) router.push(`/cards/snkrdunk/search?q=${encodeURIComponent(q)}` as never);
      else toast.error('카드 정보를 인식하지 못했어요. 하단이 잘 보이게 다시 찍어주세요.');
    } catch (e) {
      if (e instanceof CardScanError && e.code === 'AUTH') {
        toast.error('로그인 후 이용할 수 있어요');
        router.push('/login' as never);
      } else {
        toast.error(e instanceof Error ? e.message : '스캔 실패');
      }
    } finally {
      setScanBusy(false);
    }
  };

  return { scanBusy, scanToSearch };
}
