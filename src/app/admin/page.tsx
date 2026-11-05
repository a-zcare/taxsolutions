import { session } from '@/lib/security';
import Admin from '@/components/Admin';
import Login from '@/components/Login';
export const dynamic = 'force-dynamic';
export default async function Page() {
  return (await session()) ? <Admin /> : <Login />;
}
