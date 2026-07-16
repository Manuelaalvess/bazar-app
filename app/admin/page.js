import { redirect } from 'next/navigation';
import { isAdminRequest } from '../../lib/auth';
import AdminDashboard from '../../components/AdminDashboard';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  if (!isAdminRequest()) {
    redirect('/admin/login');
  }

  return <AdminDashboard />;
}
