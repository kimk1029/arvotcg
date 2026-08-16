/**
 * '촬영 → 검색 화면 전환 → OCR 진행표시 → 검색' 플로우 훅 — 웹 HomeKoSearchBar 카메라 패리티.
 * 홈 검색 인풋 카메라와 카드 추가(직접입력) 우상단 카메라가 같은 훅을 쓴다.
 *
 * 사진을 고르면 즉시 검색 화면(/cards/snkrdunk/search)으로 넘어가고,
 * 업로드·OCR·검색 진행 상태는 검색 화면이 스피너+단계 문구로 보여준다
 * (원래 화면에서 아무 반응 없어 보이던 UX 개선).
 */
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

export function useScanToSearch() {
  const [scanBusy, setScanBusy] = useState(false);

  const scanToSearch = async () => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const result = perm.granted
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      router.push(
        `/cards/snkrdunk/search?scanUri=${encodeURIComponent(a.uri)}&scanW=${a.width ?? 0}&scanH=${a.height ?? 0}` as never,
      );
    } finally {
      setScanBusy(false);
    }
  };

  return { scanBusy, scanToSearch };
}
