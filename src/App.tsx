import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import PresetsPage from './pages/dashboard/PresetsPage';
import RegexPage from './pages/dashboard/RegexPage';
import KeysPage from './pages/dashboard/KeysPage';
import OfficialKeysPage from './pages/dashboard/OfficialKeysPage';
import LogsPage from './pages/dashboard/LogsPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import AdminUsersPage from './pages/dashboard/AdminUsersPage';
import SystemPage from './pages/dashboard/SystemPage';
import { Toaster } from './components/ui/toaster';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<DashboardHome />} />
                    <Route path="presets" element={<PresetsPage />} />
                    <Route path="regex" element={<RegexPage />} />
                    <Route path="keys" element={<KeysPage />} />
                    <Route path="official-keys" element={<OfficialKeysPage />} />
                    <Route path="logs" element={<LogsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="system" element={<SystemPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
        </BrowserRouter>
    );
}

export default App;
