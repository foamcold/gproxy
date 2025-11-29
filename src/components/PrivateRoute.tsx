import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PermissionDeniedPage from '@/pages/PermissionDeniedPage';

interface PrivateRouteProps {
    allowedRoles: ('user' | 'admin')[];
}

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return <div>加载中...</div>; // 或者一个更复杂的加载指示器
    }

    if (!currentUser) {
        // 用户未登录，重定向到登录页
        return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(currentUser.role)) {
        // 用户角色不匹配，显示无权限页面
        return <PermissionDeniedPage />;
    }

    // 用户已登录且角色匹配，渲染子路由
    return <Outlet />;
}