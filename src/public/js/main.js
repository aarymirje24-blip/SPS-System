// SECTION 1 — Auth utilities
async function apiFetch(url, options = {}) {
    options.credentials = 'include';
    options.headers = options.headers || {};
    
    // Auto-set JSON content type if body is object (except FormData)
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401 && !url.includes('/login')) {
            window.location.href = '/login';
            return null;
        }
        
        // Handle no content
        if (response.status === 204) return { success: true };
        
        const data = await response.json().catch(() => null);
        
        if (!response.ok) {
            throw new Error((data && data.message) || `HTTP error! status: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// SECTION 2 — Toast notification system
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {

    // SECTION 3 — Sign out
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async () => {
            try {
                await apiFetch('/api/v1/auth/logout', { method: 'POST' });
                window.location.href = '/login';
            } catch (err) {
                console.error(err);
            }
        });
    }

    // SECTION 4 — Login page
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('login-error');
            errorDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    window.location.href = '/dashboard';
                } else {
                    errorDiv.textContent = data.message || 'Login failed';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
            }
        });
    }

    // SECTION 5 — Register page
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const org_name = document.getElementById('org_name').value;
            const full_name = document.getElementById('full_name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm_password').value;
            
            if (password !== confirm) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            try {
                await apiFetch('/api/v1/auth/register', {
                    method: 'POST',
                    body: { org_name, full_name, email, password }
                });
                window.location.href = '/dashboard';
            } catch (err) {
                // error handled by apiFetch
            }
        });
    }

    // SECTION 6 — Accept invite page
    const acceptInviteForm = document.getElementById('accept-invite-form');
    if (acceptInviteForm) {
        acceptInviteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = document.getElementById('full_name').value;
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm_password').value;
            const token = document.getElementById('token').value;
            
            if (password !== confirm) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            try {
                await apiFetch(`/api/v1/auth/accept-invite/${token}`, {
                    method: 'POST',
                    body: { full_name, password }
                });
                window.location.href = '/dashboard';
            } catch (err) {}
        });
    }

    // SECTION 7 — Upload modal
    const uploadBtn = document.getElementById('upload-btn');
    const uploadModal = document.getElementById('upload-modal');
    const closeUploadModal = document.getElementById('close-upload-modal');
    const uploadForm = document.getElementById('upload-form');
    
    if (uploadBtn && uploadModal) {
        uploadBtn.addEventListener('click', () => uploadModal.classList.add('show'));
        closeUploadModal.addEventListener('click', () => uploadModal.classList.remove('show'));
        
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('upload-file');
            if (fileInput.files.length === 0) return;
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            
            const folderSelect = document.getElementById('upload-folder');
            if (folderSelect && folderSelect.value) {
                formData.append('folder_id', folderSelect.value);
            }
            
            const tagsInput = document.getElementById('upload-tags');
            if (tagsInput && tagsInput.value) {
                formData.append('tags', tagsInput.value);
            }
            
            const descInput = document.getElementById('upload-desc');
            if (descInput && descInput.value) {
                formData.append('description', descInput.value);
            }
            
            const progress = document.getElementById('upload-progress');
            progress.style.display = 'block';
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/v1/files/upload', true);
            xhr.withCredentials = true;
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    progress.value = (e.loaded / e.total) * 100;
                }
            };
            
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    showToast('File uploaded successfully', 'success');
                    uploadModal.classList.remove('show');
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    let msg = 'Upload failed';
                    try {
                        const res = JSON.parse(xhr.responseText);
                        msg = res.message || msg;
                    } catch(e) {}
                    showToast(msg, 'error');
                }
                progress.style.display = 'none';
            };
            
            xhr.onerror = () => {
                showToast('Network error occurred during upload', 'error');
                progress.style.display = 'none';
            };
            
            xhr.send(formData);
        });
    }

    // SECTION 8 — File detail page actions
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const fileId = downloadBtn.getAttribute('data-file-id');
            try {
                const data = await apiFetch(`/api/v1/files/${fileId}/download`);
                if (data && data.url) {
                    window.open(data.url, '_blank');
                }
            } catch (err) {}
        });
    }

    const deleteFileBtn = document.getElementById('delete-file-btn');
    if (deleteFileBtn) {
        deleteFileBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete this file? This cannot be undone.')) return;
            const fileId = deleteFileBtn.getAttribute('data-file-id');
            try {
                await apiFetch(`/api/v1/files/${fileId}`, { method: 'DELETE' });
                showToast('File deleted', 'success');
                setTimeout(() => window.location.href = '/files', 1000);
            } catch (err) {}
        });
    }
    
    // File list inline delete
    document.querySelectorAll('.delete-file-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!confirm('Are you sure you want to delete this file?')) return;
            const fileId = btn.getAttribute('data-file-id');
            try {
                await apiFetch(`/api/v1/files/${fileId}`, { method: 'DELETE' });
                showToast('File deleted', 'success');
                btn.closest('tr').remove();
            } catch (err) {}
        });
    });

    // SECTION 9 — Share modal / form
    const shareForm = document.getElementById('share-form');
    if (shareForm) {
        const fileId = shareForm.getAttribute('data-file-id');
        const shareTypeRadios = document.querySelectorAll('input[name="share_type"]');
        const userSection = document.getElementById('user-search-section');
        
        shareTypeRadios.forEach(r => {
            r.addEventListener('change', (e) => {
                if (e.target.value === 'user') {
                    userSection.style.display = 'block';
                } else {
                    userSection.style.display = 'none';
                }
            });
        });
        
        shareForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const share_type = document.querySelector('input[name="share_type"]:checked').value;
            const permission = document.getElementById('permission').value;
            
            const payload = { share_type, permission };
            if (share_type === 'user') {
                const userId = document.getElementById('shared_with_user_id').value;
                if (!userId) {
                    showToast('Please select a user', 'error');
                    return;
                }
                payload.shared_with_user_id = userId;
            }
            
            try {
                await apiFetch(`/api/v1/files/${fileId}/share`, {
                    method: 'POST',
                    body: payload
                });
                showToast('Share created successfully', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {}
        });
    }
    
    document.querySelectorAll('.revoke-share-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Revoke this share?')) return;
            const fileId = btn.getAttribute('data-file-id');
            const shareId = btn.getAttribute('data-share-id');
            try {
                await apiFetch(`/api/v1/files/${fileId}/share/${shareId}`, { method: 'DELETE' });
                showToast('Share revoked', 'success');
                btn.closest('div').remove(); // remove row
            } catch (err) {}
        });
    });

    // SECTION 10 — Invite modal (admin)
    const inviteBtn = document.getElementById('invite-btn');
    const inviteModal = document.getElementById('invite-modal');
    const closeInviteModal = document.getElementById('close-invite-modal');
    const inviteForm = document.getElementById('invite-form');
    
    if (inviteBtn && inviteModal) {
        inviteBtn.addEventListener('click', () => inviteModal.classList.add('show'));
        closeInviteModal.addEventListener('click', () => inviteModal.classList.remove('show'));
        
        inviteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('invite-email').value;
            const role = document.getElementById('invite-role').value;
            
            try {
                await apiFetch('/api/v1/users/invite', {
                    method: 'POST',
                    body: { email, role }
                });
                showToast(`Invitation sent to ${email}`, 'success');
                inviteModal.classList.remove('show');
            } catch (err) {}
        });
    }

    // SECTION 11 — Avatar dropdown toggle
    const avatarBtn = document.getElementById('avatar-btn');
    const avatarMenu = document.getElementById('avatar-menu');
    if (avatarBtn && avatarMenu) {
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            avatarMenu.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
            if (!avatarMenu.contains(e.target)) {
                avatarMenu.classList.remove('show');
            }
        });
    }

    // SECTION 12 — Admin user detail page
    const adminResetPwdBtn = document.getElementById('admin-reset-pwd-btn');
    if (adminResetPwdBtn) {
        adminResetPwdBtn.addEventListener('click', async () => {
            const userId = adminResetPwdBtn.dataset.userId;
            const userName = adminResetPwdBtn.closest('.card').closest('.grid').querySelector('h2').textContent.match(/: (.+)$/)[1];
            
            if (!confirm(`Send password reset email to ${userName}?`)) return;
            
            try {
                await apiFetch(`/api/v1/users/${userId}/reset-password`, { method: 'POST' });
                showToast('Reset email sent', 'success');
            } catch (err) {}
        });
    }

    const toggleActiveBtn = document.getElementById('toggle-active-btn');
    if (toggleActiveBtn) {
        toggleActiveBtn.addEventListener('click', async () => {
            const userId = toggleActiveBtn.dataset.userId;
            const currentState = toggleActiveBtn.dataset.currentState === 'true';
            const action = currentState ? 'Deactivate' : 'Activate';
            
            if (!confirm(`${action} this user?`)) return;
            
            try {
                await apiFetch(`/api/v1/users/${userId}`, {
                    method: 'PATCH',
                    body: { is_active: !currentState }
                });
                showToast(action + ' successful', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {}
        });
    }

    const roleSelect = document.getElementById('role-select');
    if (roleSelect) {
        const originalRole = roleSelect.value;
        roleSelect.addEventListener('change', async () => {
            const userId = roleSelect.dataset.userId;
            const newRole = roleSelect.value;
            
            if (!confirm(`Change role to ${newRole}?`)) {
                roleSelect.value = originalRole;
                return;
            }
            
            try {
                await apiFetch(`/api/v1/users/${userId}`, {
                    method: 'PATCH',
                    body: { role: newRole }
                });
                showToast('Role updated', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                roleSelect.value = originalRole;
            }
        });
    }

    // SECTION 13 — Org settings form
    const orgForm = document.getElementById('org-settings-form');
    if (orgForm) {
        orgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const orgName = document.getElementById('org_name').value;
            const storageQuotaMb = document.getElementById('storage_quota_mb').value;
            
            try {
                await apiFetch('/api/v1/org/settings', {
                    method: 'PATCH',
                    body: { name: orgName, storage_quota_mb: parseInt(storageQuotaMb) }
                });
                showToast('Settings saved', 'success');
            } catch (err) {}
        });
    }

    // SECTION 14 — Profile page
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = document.getElementById('profile_full_name').value;
            
            try {
                await apiFetch('/api/v1/users/me/profile', {
                    method: 'PATCH',
                    body: { full_name }
                });
                showToast('Profile updated', 'success');
            } catch (err) {}
        });
    }

    const changePwdForm = document.getElementById('change-password-form');
    if (changePwdForm) {
        changePwdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const current_password = document.getElementById('current_password').value;
            const new_password = document.getElementById('new_password').value;
            const confirm_new_password = document.getElementById('confirm_new_password').value;
            
            if (new_password !== confirm_new_password) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            try {
                await apiFetch('/api/v1/users/me/password', {
                    method: 'PATCH',
                    body: { current_password, new_password }
                });
                showToast('Password updated', 'success');
                changePwdForm.reset();
            } catch (err) {}
        });
    }

    // SECTION 15 — New folder creation, rename, and delete
    const newFolderBtn = document.getElementById('new-folder-btn');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', async () => {
            const folderName = window.prompt('Folder name:');
            if (!folderName || folderName.trim() === '') return;
            
            const params = new URLSearchParams(window.location.search);
            const parentId = params.get('folder_id');
            
            try {
                await apiFetch('/api/v1/folders', {
                    method: 'POST',
                    body: { name: folderName.trim(), parent_id: parentId }
                });
                showToast('Folder created', 'success');
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {}
        });
    }

    window.toggleFolderMenu = function(btn) {
        const dd = btn.nextElementSibling;
        document.querySelectorAll('.folder-dropdown').forEach(d => { if (d !== dd) d.style.display = 'none'; });
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    };
    document.addEventListener('click', () => document.querySelectorAll('.folder-dropdown').forEach(d => d.style.display = 'none'));

    document.querySelectorAll('.rename-folder-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const folderId = btn.dataset.folderId;
            const currentName = btn.dataset.folderName;
            const newName = window.prompt('New folder name:', currentName);
            if (!newName || newName.trim() === currentName) return;
            
            try {
                await apiFetch(`/api/v1/folders/${folderId}`, {
                    method: 'PATCH',
                    body: { name: newName.trim() }
                });
                showToast('Folder renamed', 'success');
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {}
        });
    });

    document.querySelectorAll('.delete-folder-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!confirm('Delete this folder and all its contents? This cannot be undone.')) return;
            const folderId = btn.dataset.folderId;
            
            try {
                await apiFetch(`/api/v1/folders/${folderId}`, {
                    method: 'DELETE'
                });
                showToast('Folder deleted', 'success');
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {}
        });
    });

    // SECTION 16 — Admin admins page
    document.querySelectorAll('.role-change-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const newRole = btn.dataset.newRole;
            
            if (!confirm(`Change this user's role to ${newRole}?`)) return;
            
            try {
                await apiFetch(`/api/v1/users/${userId}`, {
                    method: 'PATCH',
                    body: { role: newRole }
                });
                showToast('Role updated', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {}
        });
    });
    
});