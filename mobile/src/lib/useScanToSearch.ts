/**
 * '촬영 → 검색 화면 전환 → OCR 진행표시 → 검색' 플로우 훅 — 웹 HomeKoSearchBar 카메라 패리티.
 * 홈 검색 인풋 카메라와 카드 추가(직접입력) 우상단 카메라가 같은 훅을 쓴다.
 *
 * 사진을 고르면 즉시 검색 화면(/cards/snkrdunk/search)으로 넘어가고,
 * 업로드·OCR·검색 진행 상태는 검색 화면이 스피너+단계 문구로 보여준다
 * (원래 화면에서 아무 반응 없어 보이던 UX 개선).
 *
 * 실패는 반드시 화면에 알린다. 예전엔 try/catch 가 없어 권한 거부·카메라 앱 없음·
 * 네이티브 모듈 오류가 전부 unhandled rejection 으로 삼켜져 "눌러도 아무 동작이 없다"
 * 로 보였다. 웹(HomeKoSearchBar/ManualAddForm)은 alert 로 알려주므로 패리티 복구.
 */
import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

const PICK_OPTS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.trim() || '알 수 없는 오류';
}

export function useScanToSearch() {
  const [scanBusy, setScanBusy] = useState(false);

  const goSearch = (a: ImagePicker.ImagePickerAsset): void => {
    router.push(
      `/cards/snkrdunk/search?scanUri=${encodeURIComponent(a.uri)}&scanW=${a.width ?? 0}&scanH=${a.height ?? 0}` as never,
    );
  };

  /** 앨범 폴백 — 카메라 권한을 거부했거나 카메라 앱이 없는 기기용. */
  const pickFromLibrary = async (): Promise<void> => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync(PICK_OPTS);
      if (!r.canceled && r.assets?.[0]) goSearch(r.assets[0]);
    } catch (e) {
      Alert.alert('앨범을 열지 못했어요', errText(e));
    }
  };

  const scanToSearch = async (): Promise<void> => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      // 카메라 권한 요청은 네이티브 launchCameraAsync 가 직접 수행한다
      // (ImagePickerModule.ensureCameraPermissionsAreGranted) — JS 쪽 사전 요청은
      // 중복이고, 그게 실패하면 조용히 앨범이 열려 "카메라를 눌렀는데 앨범"이 됐다.
      const r = await ImagePicker.launchCameraAsync(PICK_OPTS);
      if (!r.canceled && r.assets?.[0]) goSearch(r.assets[0]);
    } catch (e) {
      Alert.alert('카메라를 열지 못했어요', `${errText(e)}\n\n앨범에서 사진을 골라도 됩니다.`, [
        { text: '취소', style: 'cancel' },
        {
          text: '설정 열기',
          onPress: () => {
            Linking.openSettings().catch(() => undefined);
          },
        },
        {
          text: '앨범에서 고르기',
          onPress: () => {
            void pickFromLibrary();
          },
        },
      ]);
    } finally {
      setScanBusy(false);
    }
  };

  return { scanBusy, scanToSearch };
}
