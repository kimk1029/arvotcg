// 웹 /cards/add 와 동일 — 선택 화면 없이 '내 카드 등록' 폼으로 바로 간다.
// Redirect 는 replace 라 히스토리에 남지 않아, 폼에서 뒤로가면 진짜 이전 화면으로 나간다.
import { Redirect } from 'expo-router';

export default function CardAddScreen() {
  return <Redirect href={'/scan' as never} />;
}
