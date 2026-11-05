import { actor } from '@/lib/security';
import { redirect } from 'next/navigation';
import AdminLanguage from '@/components/AdminLanguage';
import Workspace from '@/components/Workspace';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Workspace',
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await actor();
  if (!user) redirect('/admin');
  return (
    <AdminLanguage>
      <Workspace actor={user} />
    </AdminLanguage>
  );
}
