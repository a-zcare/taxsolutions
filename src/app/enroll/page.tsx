import Enrollment from '@/components/Enrollment';
import { notFound } from 'next/navigation';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) notFound();
  return <Enrollment token={token} />;
}
