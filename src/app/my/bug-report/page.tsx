import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { BugReportForm } from '@/components/BugReportForm';

export const dynamic = 'force-dynamic';

/**
 * 버그 제보 — 사용자는 작성만 하고, 접수된 제보 목록은 어드민만 본다.
 * 앱 mobile/app/my/bug-report.tsx 와 페어.
 */
export default function Page() {
  return (
    <div className="pagebg">
      <StatusBar />
      <AppBar title="버그 제보" backHref="/my" showBack />
      <BugReportForm />
    </div>
  );
}
