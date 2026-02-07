<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface AdminUser {
		id: string;
		email: string;
		name: string;
		storageQuota: number;
		storageUsed: number;
		isAdmin: boolean;
		createdAt: string;
	}

	interface AdminStats {
		totalUsers: number;
		totalFiles: number;
		totalFolders: number;
		totalShares: number;
		totalStorageUsed: number;
	}

	let users: AdminUser[] = [];
	let stats: AdminStats | null = null;
	let isLoading = true;
	let error = '';

	// Modals
	let showCreateModal = false;
	let showEditModal = false;
	let editingUser: AdminUser | null = null;

	// Form
	let formName = '';
	let formEmail = '';
	let formPassword = '';
	let formQuotaGB = 10;
	let formIsAdmin = false;
	let formError = '';
	let isSaving = false;

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	$: if (!$auth.isLoading && $auth.user && !$auth.user.isAdmin) {
		goto('/files');
	}

	onMount(async () => {
		if ($auth.isAuthenticated && $auth.user?.isAdmin) {
			await loadData();
		}
	});

	async function loadData() {
		isLoading = true;
		error = '';

		const token = api.getToken();
		const headers: HeadersInit = {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json'
		};

		try {
			const [usersRes, statsRes] = await Promise.all([
				fetch('/api/v1/admin/users', { headers }),
				fetch('/api/v1/admin/stats', { headers })
			]);

			if (!usersRes.ok || !statsRes.ok) {
				throw new Error('Error al cargar datos');
			}

			users = await usersRes.json();
			stats = await statsRes.json();
		} catch (e) {
			error = 'Error al cargar los datos de administración';
		}

		isLoading = false;
	}

	function openCreateModal() {
		formName = '';
		formEmail = '';
		formPassword = '';
		formQuotaGB = 10;
		formIsAdmin = false;
		formError = '';
		showCreateModal = true;
	}

	function openEditModal(user: AdminUser) {
		editingUser = user;
		formName = user.name;
		formEmail = user.email;
		formPassword = '';
		formQuotaGB = Math.round(user.storageQuota / (1024 * 1024 * 1024));
		if (user.storageQuota > 100 * 1024 * 1024 * 1024 * 1024) {
			formQuotaGB = -1; // Unlimited
		}
		formIsAdmin = user.isAdmin;
		formError = '';
		showEditModal = true;
	}

	async function createUser() {
		if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
			formError = 'Todos los campos son requeridos';
			return;
		}

		isSaving = true;
		formError = '';

		const token = api.getToken();
		try {
			const res = await fetch('/api/v1/admin/users', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: formName,
					email: formEmail,
					password: formPassword,
					storageQuota: formQuotaGB === -1 ? Number.MAX_SAFE_INTEGER : formQuotaGB * 1024 * 1024 * 1024,
					isAdmin: formIsAdmin
				})
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.reason || 'Error al crear usuario');
			}

			const newUser = await res.json();
			users = [newUser, ...users];
			showCreateModal = false;
		} catch (e: any) {
			formError = e.message;
		}

		isSaving = false;
	}

	async function updateUser() {
		if (!editingUser || !formName.trim() || !formEmail.trim()) {
			formError = 'Nombre y email son requeridos';
			return;
		}

		isSaving = true;
		formError = '';

		const token = api.getToken();
		try {
			const body: any = {
				name: formName,
				email: formEmail,
				storageQuota: formQuotaGB === -1 ? Number.MAX_SAFE_INTEGER : formQuotaGB * 1024 * 1024 * 1024,
				isAdmin: formIsAdmin
			};

			if (formPassword.trim()) {
				body.password = formPassword;
			}

			const res = await fetch(`/api/v1/admin/users/${editingUser.id}`, {
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.reason || 'Error al actualizar usuario');
			}

			const updated = await res.json();
			users = users.map(u => u.id === updated.id ? updated : u);
			showEditModal = false;
		} catch (e: any) {
			formError = e.message;
		}

		isSaving = false;
	}

	async function deleteUser(user: AdminUser) {
		if (!confirm(`¿Estás seguro de eliminar a ${user.name}? Se eliminarán todos sus archivos.`)) {
			return;
		}

		const token = api.getToken();
		try {
			const res = await fetch(`/api/v1/admin/users/${user.id}`, {
				method: 'DELETE',
				headers: { 'Authorization': `Bearer ${token}` }
			});

			if (!res.ok) {
				throw new Error('Error al eliminar');
			}

			users = users.filter(u => u.id !== user.id);
		} catch (e) {
			alert('Error al eliminar el usuario');
		}
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		if (bytes > 100 * 1024 * 1024 * 1024 * 1024) return 'Ilimitado';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('es-ES', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function getUsagePercent(user: AdminUser): number {
		if (user.storageQuota > 100 * 1024 * 1024 * 1024 * 1024) return 0;
		return (user.storageUsed / user.storageQuota) * 100;
	}
</script>

<div class="admin-page">
	<header class="admin-header">
		<div class="header-left">
			<a href="/files" class="back-btn">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12"/>
					<polyline points="12 19 5 12 12 5"/>
				</svg>
			</a>
			<h1>Panel de Administración</h1>
		</div>
		<button class="btn btn-primary" on:click={openCreateModal}>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="12" y1="5" x2="12" y2="19"/>
				<line x1="5" y1="12" x2="19" y2="12"/>
			</svg>
			Nuevo Usuario
		</button>
	</header>

	{#if isLoading}
		<div class="loading-state">
			<div class="spinner spinner-lg"></div>
			<p>Cargando...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p>{error}</p>
		</div>
	{:else}
		<!-- Stats -->
		{#if stats}
			<div class="stats-grid">
				<div class="stat-card">
					<div class="stat-icon users">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
							<circle cx="9" cy="7" r="4"/>
							<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
							<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
						</svg>
					</div>
					<div class="stat-info">
						<span class="stat-value">{stats.totalUsers}</span>
						<span class="stat-label">Usuarios</span>
					</div>
				</div>

				<div class="stat-card">
					<div class="stat-icon files">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
							<polyline points="14 2 14 8 20 8"/>
						</svg>
					</div>
					<div class="stat-info">
						<span class="stat-value">{stats.totalFiles}</span>
						<span class="stat-label">Archivos</span>
					</div>
				</div>

				<div class="stat-card">
					<div class="stat-icon folders">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						</svg>
					</div>
					<div class="stat-info">
						<span class="stat-value">{stats.totalFolders}</span>
						<span class="stat-label">Carpetas</span>
					</div>
				</div>

				<div class="stat-card">
					<div class="stat-icon storage">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<ellipse cx="12" cy="5" rx="9" ry="3"/>
							<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
							<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
						</svg>
					</div>
					<div class="stat-info">
						<span class="stat-value">{formatSize(stats.totalStorageUsed)}</span>
						<span class="stat-label">Almacenamiento usado</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Users Table -->
		<div class="users-section">
			<h2>Usuarios ({users.length})</h2>

			<div class="users-table">
				<div class="table-header">
					<div class="col-name">Usuario</div>
					<div class="col-quota">Almacenamiento</div>
					<div class="col-role">Rol</div>
					<div class="col-date">Creado</div>
					<div class="col-actions"></div>
				</div>

				{#each users as user}
					<div class="table-row">
						<div class="col-name">
							<div class="user-avatar">{user.name.charAt(0)}</div>
							<div class="user-info">
								<span class="user-name-text">{user.name}</span>
								<span class="user-email">{user.email}</span>
							</div>
						</div>
						<div class="col-quota">
							<div class="quota-info">
								<span>{formatSize(user.storageUsed)} / {formatSize(user.storageQuota)}</span>
								{#if user.storageQuota < 100 * 1024 * 1024 * 1024 * 1024}
									<div class="progress-sm">
										<div class="progress-bar" style="width: {getUsagePercent(user)}%"></div>
									</div>
								{/if}
							</div>
						</div>
						<div class="col-role">
							{#if user.isAdmin}
								<span class="badge badge-admin">Admin</span>
							{:else}
								<span class="badge">Usuario</span>
							{/if}
						</div>
						<div class="col-date">{formatDate(user.createdAt)}</div>
						<div class="col-actions">
							<button class="btn-icon" on:click={() => openEditModal(user)} title="Editar">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
								</svg>
							</button>
							{#if user.id !== $auth.user?.id}
								<button class="btn-icon danger" on:click={() => deleteUser(user)} title="Eliminar">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3 6 5 6 21 6"/>
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
									</svg>
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Create User Modal -->
{#if showCreateModal}
	<div class="modal-overlay" on:click={() => showCreateModal = false}>
		<div class="modal card" on:click|stopPropagation>
			<h2>Nuevo Usuario</h2>
			<div class="modal-body">
				<div class="input-group">
					<label for="create-name">Nombre</label>
					<input id="create-name" type="text" class="input" bind:value={formName} placeholder="Nombre completo" />
				</div>
				<div class="input-group">
					<label for="create-email">Email</label>
					<input id="create-email" type="email" class="input" bind:value={formEmail} placeholder="email@ejemplo.com" />
				</div>
				<div class="input-group">
					<label for="create-password">Contraseña</label>
					<input id="create-password" type="password" class="input" bind:value={formPassword} placeholder="Contraseña" />
				</div>
				<div class="input-group">
					<label for="create-quota">Cuota de almacenamiento (GB)</label>
					<select id="create-quota" class="input" bind:value={formQuotaGB}>
						<option value={1}>1 GB</option>
						<option value={5}>5 GB</option>
						<option value={10}>10 GB</option>
						<option value={25}>25 GB</option>
						<option value={50}>50 GB</option>
						<option value={100}>100 GB</option>
						<option value={500}>500 GB</option>
						<option value={1000}>1 TB</option>
						<option value={-1}>Ilimitado</option>
					</select>
				</div>
				<div class="checkbox-group">
					<input type="checkbox" id="create-admin" class="checkbox" bind:checked={formIsAdmin} />
					<label for="create-admin">Es administrador</label>
				</div>

				{#if formError}
					<p class="error-message">{formError}</p>
				{/if}
			</div>
			<div class="modal-actions">
				<button class="btn btn-secondary" on:click={() => showCreateModal = false}>Cancelar</button>
				<button class="btn btn-primary" on:click={createUser} disabled={isSaving}>
					{isSaving ? 'Creando...' : 'Crear Usuario'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit User Modal -->
{#if showEditModal && editingUser}
	<div class="modal-overlay" on:click={() => showEditModal = false}>
		<div class="modal card" on:click|stopPropagation>
			<h2>Editar Usuario</h2>
			<div class="modal-body">
				<div class="input-group">
					<label for="edit-name">Nombre</label>
					<input id="edit-name" type="text" class="input" bind:value={formName} />
				</div>
				<div class="input-group">
					<label for="edit-email">Email</label>
					<input id="edit-email" type="email" class="input" bind:value={formEmail} />
				</div>
				<div class="input-group">
					<label for="edit-password">Nueva contraseña (dejar vacío para no cambiar)</label>
					<input id="edit-password" type="password" class="input" bind:value={formPassword} placeholder="Nueva contraseña" />
				</div>
				<div class="input-group">
					<label for="edit-quota">Cuota de almacenamiento (GB)</label>
					<select id="edit-quota" class="input" bind:value={formQuotaGB}>
						<option value={1}>1 GB</option>
						<option value={5}>5 GB</option>
						<option value={10}>10 GB</option>
						<option value={25}>25 GB</option>
						<option value={50}>50 GB</option>
						<option value={100}>100 GB</option>
						<option value={500}>500 GB</option>
						<option value={1000}>1 TB</option>
						<option value={-1}>Ilimitado</option>
					</select>
				</div>
				{#if editingUser.id !== $auth.user?.id}
					<div class="checkbox-group">
						<input type="checkbox" id="edit-admin" class="checkbox" bind:checked={formIsAdmin} />
						<label for="edit-admin">Es administrador</label>
					</div>
				{/if}

				{#if formError}
					<p class="error-message">{formError}</p>
				{/if}
			</div>
			<div class="modal-actions">
				<button class="btn btn-secondary" on:click={() => showEditModal = false}>Cancelar</button>
				<button class="btn btn-primary" on:click={updateUser} disabled={isSaving}>
					{isSaving ? 'Guardando...' : 'Guardar Cambios'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.admin-page {
		min-height: 100vh;
		background: var(--bg);
		padding: 24px;
	}

	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 32px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: var(--bg-card);
		border-radius: 8px;
		color: var(--text-secondary);
	}

	.back-btn:hover {
		background: var(--bg-hover);
		color: var(--text);
		text-decoration: none;
	}

	.admin-header h1 {
		font-size: 24px;
		font-weight: 600;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 32px;
	}

	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 20px;
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.stat-icon {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stat-icon.users { background: rgba(0, 130, 201, 0.15); color: var(--primary-light); }
	.stat-icon.files { background: rgba(70, 186, 97, 0.15); color: var(--success); }
	.stat-icon.folders { background: rgba(233, 166, 38, 0.15); color: var(--warning); }
	.stat-icon.storage { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }

	.stat-value {
		font-size: 24px;
		font-weight: 700;
		display: block;
	}

	.stat-label {
		font-size: 13px;
		color: var(--text-secondary);
	}

	/* Users Section */
	.users-section {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 24px;
	}

	.users-section h2 {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 20px;
	}

	/* Table */
	.users-table {
		overflow-x: auto;
	}

	.table-header,
	.table-row {
		display: grid;
		grid-template-columns: 2fr 1.5fr 100px 120px 80px;
		align-items: center;
		gap: 16px;
	}

	.table-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}

	.table-row {
		padding: 16px;
		border-bottom: 1px solid var(--border-light);
		border-radius: 8px;
		margin: 0 -16px;
	}

	.table-row:hover {
		background: var(--bg-hover);
	}

	.col-name {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.col-quota { min-width: 0; }
	.col-role { min-width: 0; }
	.col-date { min-width: 0; color: var(--text-secondary); }
	.col-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.user-avatar {
		width: 40px;
		height: 40px;
		background: var(--primary);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 16px;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.user-name-text {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-email {
		font-size: 13px;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quota-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.quota-info span {
		font-size: 13px;
	}

	.progress-sm {
		height: 4px;
		background: var(--bg-hover);
		border-radius: 2px;
		width: 100px;
	}

	.progress-sm .progress-bar {
		height: 100%;
		background: var(--primary);
		border-radius: 2px;
	}

	.badge-admin {
		background: rgba(233, 50, 45, 0.15);
		color: var(--error);
	}

	.btn-icon.danger {
		color: var(--error);
	}

	.btn-icon.danger:hover {
		background: rgba(233, 50, 45, 0.1);
	}

	/* Loading/Error States */
	.loading-state, .error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		gap: 16px;
		color: var(--text-secondary);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.col-quota, .col-date {
			display: none;
		}
	}
</style>
