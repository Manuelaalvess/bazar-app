import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, verifySessionToken } from '../../lib/auth';
import AdminDashboard from '../../components/AdminDashboard';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const authed = token ? verifySessionToken(token) : false;

  if (!authed) {
    redirect('/admin/login');
  }

  return <AdminDashboard />;
}
