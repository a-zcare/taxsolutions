import { actor } from '@/lib/security';
import {redirect} from 'next/navigation';
import Admin from '@/components/Admin';
import Login from '@/components/Login';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user=await actor();if(user?.role==='ACCOUNTANT')redirect('/workspace');return user?<Admin/>:<Login/>;
}
