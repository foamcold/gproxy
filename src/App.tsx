import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import InitializePage from './pages/InitializePage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import PresetsPage from './pages/dashboard/PresetsPage';
import RegexPage from './pages/dashboard/RegexPage';
import KeysPage from './pages/dashboard/KeysPage';
import LogsPage from './pages/dashboard/LogsPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import AdminUsersPage from './pages/dashboard/AdminUsersPage';
import SystemPage from './pages/dashboard/SystemPage';
import { Toaster } from './components/ui/toaster';
import { ConfirmDialog } from './components/ui/ConfirmDialog';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/initialize" element={<InitializePage />} />
                <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<DashboardHome />} />
                    <Route path="presets" element={<PresetsPage />} />
                    <Route path="regex" element={<RegexPage />} />
                    <Route path="keys" element={<KeysPage />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="system" element={<SystemPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
            <ConfirmDialog />
        </BrowserRouter>
    );
}

export default App;
