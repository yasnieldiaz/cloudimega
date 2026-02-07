<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { api, type CloudFile, type ActivityLog, type Share } from '$lib/api/client';

	let isLoading = true;
	let activeTab = 'home';
	let stats = {
		recentFiles: [] as CloudFile[],
		totalFiles: 0,
		favorites: { files: [] as CloudFile[], folders: [] },
		trash: [] as CloudFile[],
		shares: [] as Share[],
		recentActivity: [] as ActivityLog[]
	};

	// Filtered files by type
	$: recentPhotos = stats.recentFiles.filter(f => f.mimeType.startsWith('image/')).slice(0, 6);
	$: recentVideos = stats.recentFiles.filter(f => f.mimeType.startsWith('video/')).slice(0, 4);
	$: recentAudio = stats.recentFiles.filter(f => f.mimeType.startsWith('audio/')).slice(0, 4);
	$: recentDocs = stats.recentFiles.filter(f =>
		f.mimeType.includes('pdf') || f.mimeType.includes('document') || f.mimeType.includes('word') || f.mimeType.includes('sheet')
	).slice(0, 4);

	$: user = $auth.user;
	$: storagePercent = user ? Math.round((user.storageUsed / user.storageQuota) * 100) : 0;

	onMount(async () => {
		if (!$auth.isAuthenticated && !$auth.isLoading) {
			goto('/auth/login');
			return;
		}

		const data = await api.getDashboardStats();
		stats = data;
		isLoading = false;
	});

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Ahora';
		if (minutes < 60) return `Hace ${minutes}m`;
		if (hours < 24) return `Hace ${hours}h`;
		if (days < 7) return `Hace ${days}d`;
		return date.toLocaleDateString('es-ES');
	}

	function getFileIcon(mimeType: string): string {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType.includes('pdf')) return 'pdf';
		if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
		if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'sheet';
		if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
		return 'file';
	}
</script>

<svelte:head>
	<title>Dashboard - CloudImega</title>
</svelte:head>

<div class="dashboard">
	{#if isLoading}
		<div class="loading">
			<div class="spinner spinner-lg"></div>
			<p>Cargando...</p>
		</div>
	{:else}
		<!-- Hero Section -->
		<header class="hero">
			<div class="hero-content">
				<img src="/logo.png" alt="CloudImega" class="hero-logo" />
				<h1>Bienvenido, {user?.name || 'Usuario'}</h1>
				<p>Tu espacio seguro en la nube</p>
			</div>
			<nav class="hero-nav">
				<a href="/files" class="hero-btn">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
					</svg>
					Mis Archivos
				</a>
				<a href="/settings" class="hero-btn secondary">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="3"/>
						<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
					</svg>
					Ajustes
				</a>
				<button class="hero-btn logout" on:click={() => auth.logout()}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
					</svg>
				</button>
			</nav>
		</header>

		<main class="main-content">
			<!-- Storage Card -->
			<section class="storage-section">
				<div class="storage-card">
					<div class="storage-header">
						<div class="storage-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
								<polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
								<line x1="12" y1="22.08" x2="12" y2="12"/>
							</svg>
						</div>
						<div class="storage-info">
							<h3>Almacenamiento</h3>
							<p>{formatBytes(user?.storageUsed || 0)} de {formatBytes(user?.storageQuota || 0)}</p>
						</div>
						<span class="storage-percent">{storagePercent}%</span>
					</div>
					<div class="storage-bar">
						<div class="storage-fill" style="width: {storagePercent}%"></div>
					</div>
				</div>
			</section>

			<!-- Stats Grid -->
			<section class="stats-section">
				<a href="/files" class="stat-card">
					<div class="stat-icon blue">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
							<polyline points="13,2 13,9 20,9"/>
						</svg>
					</div>
					<div class="stat-content">
						<span class="stat-value">{stats.totalFiles}</span>
						<span class="stat-label">Archivos</span>
					</div>
				</a>

				<a href="/files?view=favorites" class="stat-card">
					<div class="stat-icon gold">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
						</svg>
					</div>
					<div class="stat-content">
						<span class="stat-value">{stats.favorites.files.length + stats.favorites.folders.length}</span>
						<span class="stat-label">Favoritos</span>
					</div>
				</a>

				<a href="/files?view=shared" class="stat-card">
					<div class="stat-icon green">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<circle cx="18" cy="5" r="3"/>
							<circle cx="6" cy="12" r="3"/>
							<circle cx="18" cy="19" r="3"/>
							<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
							<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
						</svg>
					</div>
					<div class="stat-content">
						<span class="stat-value">{stats.shares.length}</span>
						<span class="stat-label">Compartidos</span>
					</div>
				</a>

				<a href="/files?view=trash" class="stat-card">
					<div class="stat-icon red">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<polyline points="3,6 5,6 21,6"/>
							<path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
							<line x1="10" y1="11" x2="10" y2="17"/>
							<line x1="14" y1="11" x2="14" y2="17"/>
						</svg>
					</div>
					<div class="stat-content">
						<span class="stat-value">{stats.trash.length}</span>
						<span class="stat-label">Papelera</span>
					</div>
				</a>
			</section>

			<!-- Quick Access -->
			<section class="quick-section">
				<h2>Acceso Rapido</h2>
				<div class="quick-grid">
					<a href="/files" class="quick-item">
						<div class="quick-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
								<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
							</svg>
						</div>
						<span>Archivos</span>
					</a>
					<a href="/photos" class="quick-item">
						<div class="quick-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
								<circle cx="8.5" cy="8.5" r="1.5"/>
								<polyline points="21,15 16,10 5,21"/>
							</svg>
						</div>
						<span>Fotos</span>
					</a>
					<a href="/notes" class="quick-item">
						<div class="quick-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
								<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
								<polyline points="14,2 14,8 20,8"/>
								<line x1="16" y1="13" x2="8" y2="13"/>
								<line x1="16" y1="17" x2="8" y2="17"/>
							</svg>
						</div>
						<span>Notas</span>
					</a>
					<a href="/calendar" class="quick-item">
						<div class="quick-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
								<line x1="16" y1="2" x2="16" y2="6"/>
								<line x1="8" y1="2" x2="8" y2="6"/>
								<line x1="3" y1="10" x2="21" y2="10"/>
							</svg>
						</div>
						<span>Calendario</span>
					</a>
					<a href="/contacts" class="quick-item">
						<div class="quick-icon" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.5">
								<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
								<circle cx="12" cy="7" r="4"/>
							</svg>
						</div>
						<span>Contactos</span>
					</a>
					{#if user?.isAdmin}
						<a href="/admin" class="quick-item">
							<div class="quick-icon" style="background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
								</svg>
							</div>
							<span>Admin</span>
						</a>
					{/if}
				</div>
			</section>

			<!-- Bottom Grid -->
			<div class="bottom-section">
				<!-- Recent Files -->
				<section class="card-section">
					<div class="card-header">
						<h2>Archivos Recientes</h2>
						<a href="/files" class="see-all">Ver todos</a>
					</div>
					{#if stats.recentFiles.length === 0}
						<div class="empty-state">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
								<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
								<polyline points="14,2 14,8 20,8"/>
							</svg>
							<p>No hay archivos recientes</p>
						</div>
					{:else}
						<ul class="file-list">
							{#each stats.recentFiles as file}
								<li class="file-item">
									<div class="file-icon {getFileIcon(file.mimeType)}">
										{#if file.mimeType.startsWith('image/')}
											<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
												<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
												<circle cx="8.5" cy="8.5" r="1.5"/>
												<polyline points="21,15 16,10 5,21"/>
											</svg>
										{:else if file.mimeType.startsWith('audio/')}
											<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
												<path d="M9 18V5l12-2v13"/>
												<circle cx="6" cy="18" r="3"/>
												<circle cx="18" cy="16" r="3"/>
											</svg>
										{:else if file.mimeType.startsWith('video/')}
											<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
												<polygon points="23,7 16,12 23,17"/>
												<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
											</svg>
										{:else}
											<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
												<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
												<polyline points="14,2 14,8 20,8"/>
											</svg>
										{/if}
									</div>
									<div class="file-info">
										<span class="file-name">{file.name}</span>
										<span class="file-meta">{formatBytes(file.size)} &bull; {formatDate(file.updatedAt)}</span>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<!-- Recent Activity -->
				<section class="card-section">
					<div class="card-header">
						<h2>Actividad Reciente</h2>
					</div>
					{#if stats.recentActivity.length === 0}
						<div class="empty-state">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
								<polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
							</svg>
							<p>No hay actividad reciente</p>
						</div>
					{:else}
						<ul class="activity-list">
							{#each stats.recentActivity.slice(0, 6) as activity}
								<li class="activity-item">
									<div class="activity-dot"></div>
									<div class="activity-content">
										<span class="activity-action">{activity.action}</span>
										<span class="activity-file">{activity.resourceName}</span>
										<span class="activity-time">{formatDate(activity.createdAt)}</span>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		<!-- Mobile Bottom Navigation -->
		<nav class="mobile-nav">
			<a href="/dashboard" class="nav-item active">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
					<polyline points="9,22 9,12 15,12 15,22"/>
				</svg>
				<span>Inicio</span>
			</a>
			<a href="/files" class="nav-item">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
				</svg>
				<span>Archivos</span>
			</a>
			<a href="/photos" class="nav-item">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
					<circle cx="8.5" cy="8.5" r="1.5"/>
					<polyline points="21,15 16,10 5,21"/>
				</svg>
				<span>Fotos</span>
			</a>
			<a href="/videos" class="nav-item">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polygon points="23,7 16,12 23,17"/>
					<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
				</svg>
				<span>Videos</span>
			</a>
			<a href="/settings" class="nav-item">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"/>
					<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
				</svg>
				<span>Mas</span>
			</a>
		</nav>
	</main>
	{/if}
</div>

<style>
	.dashboard {
		min-height: 100vh;
		background: #ffffff;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 16px;
		color: #666;
	}

	/* Hero Section */
	.hero {
		text-align: center;
		padding: 60px 24px 40px;
		position: relative;
	}

	.hero-content {
		margin-bottom: 32px;
	}

	.hero-logo {
		width: 180px;
		height: 180px;
		object-fit: contain;
		margin-bottom: 24px;
		filter: drop-shadow(0 10px 30px rgba(0,130,201,0.2));
		animation: float 3s ease-in-out infinite;
	}

	@keyframes float {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}

	.hero h1 {
		font-size: 32px;
		font-weight: 700;
		color: #1a1a1a;
		margin: 0 0 8px;
	}

	.hero p {
		font-size: 16px;
		color: #666;
		margin: 0;
	}

	.hero-nav {
		display: flex;
		justify-content: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.hero-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 24px;
		background: linear-gradient(135deg, #0082c9, #00a4f5);
		color: white;
		border: none;
		border-radius: 50px;
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 15px rgba(0,130,201,0.4);
	}

	.hero-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(0,130,201,0.5);
	}

	.hero-btn.secondary {
		background: #e8e8e8;
		color: #1a1a1a;
		border: 1px solid #ccc;
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
	}

	.hero-btn.secondary:hover {
		background: #d8d8d8;
	}

	.hero-btn.logout {
		padding: 12px;
		background: #e8e8e8;
		color: #666;
		border: 1px solid #ccc;
		box-shadow: none;
	}

	.hero-btn.logout:hover {
		background: #ffebee;
		color: #e9322d;
		border-color: #e9322d;
	}

	/* Main Content */
	.main-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24px 60px;
	}

	/* Storage Section */
	.storage-section {
		margin-bottom: 32px;
	}

	.storage-card {
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 20px;
		padding: 24px;
	}

	.storage-header {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}

	.storage-icon {
		width: 48px;
		height: 48px;
		background: linear-gradient(135deg, #667eea, #764ba2);
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
	}

	.storage-info {
		flex: 1;
	}

	.storage-info h3 {
		font-size: 16px;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 4px;
	}

	.storage-info p {
		font-size: 13px;
		color: #666;
		margin: 0;
	}

	.storage-percent {
		font-size: 24px;
		font-weight: 700;
		color: #1a1a1a;
	}

	.storage-bar {
		height: 8px;
		background: #e0e0e0;
		border-radius: 4px;
		overflow: hidden;
	}

	.storage-fill {
		height: 100%;
		background: linear-gradient(90deg, #667eea, #764ba2);
		border-radius: 4px;
		transition: width 0.5s ease;
	}

	/* Stats Section */
	.stats-section {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
		margin-bottom: 32px;
	}

	.stat-card {
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 20px;
		padding: 24px;
		text-decoration: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		transition: all 0.3s ease;
	}

	.stat-card:hover {
		transform: translateY(-5px);
		background: #f0f0f0;
		border-color: #ccc;
	}

	.stat-icon {
		width: 64px;
		height: 64px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 16px;
	}

	.stat-icon.blue { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
	.stat-icon.gold { background: linear-gradient(135deg, #f6d365, #fda085); color: white; }
	.stat-icon.green { background: linear-gradient(135deg, #11998e, #38ef7d); color: white; }
	.stat-icon.red { background: linear-gradient(135deg, #ff416c, #ff4b2b); color: white; }

	.stat-content {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 36px;
		font-weight: 700;
		color: #1a1a1a;
		line-height: 1;
	}

	.stat-label {
		font-size: 14px;
		color: #666;
		margin-top: 4px;
	}

	/* Quick Access */
	.quick-section {
		margin-bottom: 32px;
		text-align: center;
	}

	.quick-section h2 {
		font-size: 20px;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 20px;
	}

	.quick-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 16px;
	}

	.quick-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 20px 16px;
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 16px;
		text-decoration: none;
		transition: all 0.3s ease;
	}

	.quick-item:hover {
		transform: translateY(-5px);
		background: #f0f0f0;
	}

	.quick-icon {
		width: 56px;
		height: 56px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 20px rgba(0,0,0,0.2);
	}

	.quick-item span {
		font-size: 13px;
		font-weight: 500;
		color: #1a1a1a;
	}

	/* Bottom Section */
	.bottom-section {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 24px;
	}

	.card-section {
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 20px;
		padding: 24px;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}

	.card-header h2 {
		font-size: 18px;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0;
	}

	.see-all {
		font-size: 13px;
		color: #00a4f5;
		text-decoration: none;
	}

	.see-all:hover {
		text-decoration: underline;
	}

	/* File List */
	.file-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.file-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.file-item:last-child {
		border-bottom: none;
	}

	.file-icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #e0e0e0;
		color: #666;
	}

	.file-icon.image { background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
	.file-icon.video { background: linear-gradient(135deg, #ff416c, #ff4b2b); color: white; }
	.file-icon.audio { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
	.file-icon.pdf { background: linear-gradient(135deg, #eb3349, #f45c43); color: white; }
	.file-icon.doc { background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; }

	.file-info {
		flex: 1;
		min-width: 0;
	}

	.file-name {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: #1a1a1a;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-meta {
		font-size: 12px;
		color: #666;
	}

	/* Activity List */
	.activity-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.activity-item {
		display: flex;
		gap: 14px;
		padding: 12px 0;
		border-bottom: 1px solid #e0e0e0;
	}

	.activity-item:last-child {
		border-bottom: none;
	}

	.activity-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea, #764ba2);
		margin-top: 5px;
		flex-shrink: 0;
	}

	.activity-content {
		flex: 1;
	}

	.activity-action {
		font-size: 14px;
		font-weight: 500;
		color: #1a1a1a;
		text-transform: capitalize;
	}

	.activity-file {
		display: block;
		font-size: 13px;
		color: #444;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.activity-time {
		font-size: 12px;
		color: #888;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: #888;
		text-align: center;
	}

	.empty-state svg {
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	/* Mobile Bottom Navigation */
	.mobile-nav {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #ffffff;
		border-top: 1px solid #e0e0e0;
		padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
		z-index: 1000;
		box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
	}

	.mobile-nav .nav-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		color: #666;
		text-decoration: none;
		font-size: 11px;
		transition: color 0.2s ease;
	}

	.mobile-nav .nav-item.active {
		color: #0082c9;
	}

	.mobile-nav .nav-item:hover {
		color: #0082c9;
	}

	.mobile-nav .nav-item svg {
		transition: transform 0.2s ease;
	}

	.mobile-nav .nav-item.active svg {
		transform: scale(1.1);
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.stats-section {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
		.dashboard {
			padding-bottom: 80px;
		}

		.mobile-nav {
			display: flex;
		}

		.hero {
			padding: 30px 16px 20px;
		}

		.hero-logo {
			width: 100px;
			height: 100px;
			margin-bottom: 16px;
		}

		.hero h1 {
			font-size: 22px;
		}

		.hero p {
			font-size: 14px;
		}

		.hero-nav {
			gap: 8px;
		}

		.hero-btn {
			padding: 10px 16px;
			font-size: 13px;
		}

		.hero-btn.logout {
			display: none;
		}

		.main-content {
			padding: 0 12px 40px;
		}

		.storage-card {
			padding: 16px;
			border-radius: 16px;
		}

		.storage-icon {
			width: 40px;
			height: 40px;
		}

		.storage-percent {
			font-size: 20px;
		}

		.stats-section {
			grid-template-columns: repeat(2, 1fr);
			gap: 10px;
			margin-bottom: 24px;
		}

		.stat-card {
			padding: 14px;
			border-radius: 16px;
		}

		.stat-icon {
			width: 44px;
			height: 44px;
			margin-bottom: 10px;
		}

		.stat-icon svg {
			width: 24px;
			height: 24px;
		}

		.stat-value {
			font-size: 24px;
		}

		.stat-label {
			font-size: 12px;
		}

		.quick-section {
			margin-bottom: 24px;
		}

		.quick-section h2 {
			font-size: 16px;
			margin-bottom: 14px;
		}

		.quick-grid {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 10px;
		}

		.quick-item {
			padding: 14px 10px;
			border-radius: 14px;
		}

		.quick-icon {
			width: 44px;
			height: 44px;
			border-radius: 12px;
		}

		.quick-icon svg {
			width: 22px;
			height: 22px;
		}

		.quick-item span {
			font-size: 11px;
		}

		.bottom-section {
			grid-template-columns: 1fr;
			gap: 16px;
		}

		.card-section {
			padding: 16px;
			border-radius: 16px;
		}

		.card-header h2 {
			font-size: 16px;
		}

		.file-item {
			padding: 10px 0;
		}

		.file-icon {
			width: 38px;
			height: 38px;
		}

		.file-name {
			font-size: 13px;
		}

		.file-meta {
			font-size: 11px;
		}

		.activity-item {
			padding: 10px 0;
		}

		.activity-action {
			font-size: 13px;
		}

		.activity-file {
			font-size: 12px;
		}
	}

	@media (max-width: 380px) {
		.stats-section {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}

		.stat-card {
			padding: 12px;
		}

		.stat-value {
			font-size: 20px;
		}

		.quick-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 8px;
		}

		.quick-item {
			padding: 12px 8px;
		}

		.quick-icon {
			width: 40px;
			height: 40px;
		}
	}
</style>
