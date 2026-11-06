import { actor } from '@/lib/security';
import Workspace from '@/components/Workspace';
import Login from '@/components/Login';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await actor();
  return user ? <Workspace actor={user} /> : <Login />;
}
