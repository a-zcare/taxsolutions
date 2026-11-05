import AdminLanguage from '@/components/AdminLanguage';
export const metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLanguage>{children}</AdminLanguage>;
}
