class PageController {
    renderHome(req, res) {
        res.sendFile('home.html', { root: './src/views' });
    }

    renderAbout(req, res) {
        res.sendFile('about.html', { root: './src/views' });
    }

    renderLogin(req, res) {
        res.sendFile('1_login.html', { root: './src/views' });
    }

    renderAdminDashboard(req, res) {
        res.sendFile('2_admin_dashboard.html', { root: './src/views' });
    }

    renderUserDashboard(req, res) {
        res.sendFile('3_user_dashboard.html', { root: './src/views' });
    }

    renderUploadFile(req, res) {
        res.sendFile('4_upload_file.html', { root: './src/views' });
    }

    renderManageUsers(req, res) {
        res.sendFile('5_manage_users.html', { root: './src/views' });
    }

    renderAllFiles(req, res) {
        res.sendFile('6_all_files.html', { root: './src/views' });
    }

    renderSharedFiles(req, res) {
        res.sendFile('7_shared_files.html', { root: './src/views' });
    }

    renderActivityLogs(req, res) {
        res.sendFile('8_activity_logs.html', { root: './src/views' });
    }

    renderSettings(req, res) {
        res.sendFile('9_settings.html', { root: './src/views' });
    }

    render404(req, res) {
        res.sendFile('404.html', { root: './src/views' });
    }
}

module.exports = PageController;