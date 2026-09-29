import type { Metadata } from 'next';

import AdminPanel from './admin-panel';

export const metadata: Metadata = {
  title: 'Promoter approvals - Palestine Profile Pic Maker',
  robots: { index: false, follow: false },
};

/**
 * Where approvers review leaderboard join requests. The page itself is
 * public HTML with nothing in it; every read and write goes through
 * /api/admin/promoters, which needs the admin token.
 */
export default function AdminPromotersPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-1">Promoter approvals</h1>
      <p className="text-sm text-gray-600 mb-6">
        Approve only people you can vouch for, or whose link checks out.
        Anything approved here appears on the public leaderboard within five
        minutes.
      </p>
      <AdminPanel />
    </main>
  );
}
