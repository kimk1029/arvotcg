import { AdminReportList, type AdminReportRow, type AdminBlockRow } from '@/components/admin/AdminReportList';
import { AppBar } from '@/components/ui/AppBar';
import { StatusBar } from '@/components/ui/StatusBar';
import { serverFetch } from '@/lib/apiServer';

export const dynamic = 'force-dynamic';

/** /admin/reports — 신고 접수 목록 + 차단 현황 (App Store 심사 지침 1.2 운영 도구). */
export default async function AdminReportsPage() {
  const [reports, blocks] = await Promise.all([
    serverFetch<{ data: AdminReportRow[]; counts: Record<string, number> }>('/api/admin/reports?status=open'),
    serverFetch<{ data: AdminBlockRow[] }>('/api/admin/blocks'),
  ]);

  return (
    <>
      <StatusBar />
      <AppBar title="신고 · 차단 관리" showBack backHref="/admin" />
      <div style={{ height: 14 }} />
      <AdminReportList
        initialReports={reports.data?.data ?? []}
        initialCounts={reports.data?.counts ?? {}}
        blocks={blocks.data?.data ?? []}
      />
      <div className="bggap" />
    </>
  );
}
