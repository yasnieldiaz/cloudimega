<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	interface ShareInfo {
		fileName: string;
		fileSize: number;
		mimeType: string;
		hasPassword: boolean;
		expiresAt?: string;
		isExpired: boolean;
		downloadCount: number;
		maxDownloads?: number;
	}

	let shareInfo: ShareInfo | null = null;
	let error = '';
	let isLoading = true;
	let password = '';
	let passwordError = '';
	let isVerifying = false;
	let isAuthenticated = false;
	let isDownloading = false;

	$: token = $page.params.token;

	onMount(async () => {
		await loadShareInfo();
	});

	async function loadShareInfo() {
		isLoading = true;
		error = '';

		try {
			const response = await fetch(`/s/${token}`);
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				error = data.reason || 'Enlace no válido o expirado';
				isLoading = false;
				return;
			}

			shareInfo = await response.json();
			isAuthenticated = !shareInfo?.hasPassword;
		} catch (e) {
			error = 'Error al cargar el archivo';
		}

		isLoading = false;
	}

	async function verifyPassword() {
		if (!password.trim()) return;

		isVerifying = true;
		passwordError = '';

		try {
			const response = await fetch(`/s/${token}/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			if (response.ok) {
				isAuthenticated = true;
			} else {
				passwordError = 'Contraseña incorrecta';
			}
		} catch (e) {
			passwordError = 'Error al verificar';
		}

		isVerifying = false;
	}

	function downloadFile() {
		const downloadUrl = `/s/${token}/download${shareInfo?.hasPassword ? `?password=${encodeURIComponent(password)}` : ''}`;
		window.location.href = downloadUrl;
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('es-ES', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function getFileIcon(mimeType: string, name: string): string {
		if (mimeType?.startsWith('image/')) return 'image';
		if (mimeType?.startsWith('video/')) return 'video';
		if (mimeType?.startsWith('audio/')) return 'audio';
		if (mimeType?.includes('pdf')) return 'pdf';
		if (mimeType?.includes('zip') || mimeType?.includes('rar')) return 'archive';
		return 'file';
	}

	function canPreview(mimeType: string): boolean {
		if (!mimeType) return false;
		return mimeType.startsWith('image/') ||
			mimeType.startsWith('video/') ||
			mimeType.startsWith('audio/') ||
			mimeType.includes('pdf');
	}

	$: downloadUrl = `/s/${token}/download${shareInfo?.hasPassword && isAuthenticated ? `?password=${encodeURIComponent(password)}` : ''}`;
</script>

<svelte:head>
	<title>{shareInfo?.fileName || 'Archivo compartido'} - CloudImega</title>
</svelte:head>

<div class="share-page">
	<div class="share-container">
		<div class="brand">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
			</svg>
			<span>CloudImega</span>
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner spinner-lg"></div>
				<p>Cargando archivo...</p>
			</div>
		{:else if error}
			<div class="error-state card">
				<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="12" cy="12" r="10"/>
					<line x1="15" y1="9" x2="9" y2="15"/>
					<line x1="9" y1="9" x2="15" y2="15"/>
				</svg>
				<h2>No disponible</h2>
				<p>{error}</p>
				<a href="/" class="btn btn-primary">Ir al inicio</a>
			</div>
		{:else if shareInfo}
			<div class="share-card card">
				{#if !isAuthenticated && shareInfo.hasPassword}
					<!-- Password Required -->
					<div class="password-section">
						<div class="file-preview-locked">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
								<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
							</svg>
						</div>
						<h2>Archivo protegido</h2>
						<p>Este archivo requiere una contraseña para acceder</p>

						<form on:submit|preventDefault={verifyPassword} class="password-form">
							<div class="input-group">
								<input
									type="password"
									class="input"
									bind:value={password}
									placeholder="Introduce la contraseña"
									required
								/>
							</div>

							{#if passwordError}
								<p class="error-message">{passwordError}</p>
							{/if}

							<button type="submit" class="btn btn-primary btn-full" disabled={isVerifying}>
								{#if isVerifying}
									<div class="spinner spinner-sm"></div>
									Verificando...
								{:else}
									Acceder
								{/if}
							</button>
						</form>
					</div>
				{:else}
					<!-- File Info -->
					<div class="file-section">
						<div class="file-icon-large">
							{#if getFileIcon(shareInfo.mimeType, shareInfo.fileName) === 'image'}
								<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="1.5">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
									<circle cx="8.5" cy="8.5" r="1.5"/>
									<polyline points="21 15 16 10 5 21"/>
								</svg>
							{:else if getFileIcon(shareInfo.mimeType, shareInfo.fileName) === 'video'}
								<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="1.5">
									<polygon points="23 7 16 12 23 17 23 7"/>
									<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
								</svg>
							{:else if getFileIcon(shareInfo.mimeType, shareInfo.fileName) === 'audio'}
								<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5">
									<path d="M9 18V5l12-2v13"/>
									<circle cx="6" cy="18" r="3"/>
									<circle cx="18" cy="16" r="3"/>
								</svg>
							{:else if getFileIcon(shareInfo.mimeType, shareInfo.fileName) === 'pdf'}
								<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
									<polyline points="14 2 14 8 20 8"/>
								</svg>
							{:else}
								<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
									<polyline points="14 2 14 8 20 8"/>
								</svg>
							{/if}
						</div>

						<h2 class="file-name">{shareInfo.fileName}</h2>

						<div class="file-meta">
							<span class="badge">{formatSize(shareInfo.fileSize)}</span>
							{#if shareInfo.expiresAt}
								<span class="badge">Expira: {formatDate(shareInfo.expiresAt)}</span>
							{/if}
						</div>

						<!-- Preview for media files -->
						{#if canPreview(shareInfo.mimeType) && isAuthenticated}
							<div class="preview-container">
								{#if shareInfo.mimeType.startsWith('image/')}
									<img src={downloadUrl} alt={shareInfo.fileName} class="preview-image" />
								{:else if shareInfo.mimeType.startsWith('video/')}
									<video controls class="preview-video">
										<source src={downloadUrl} type={shareInfo.mimeType} />
										<track kind="captions" />
										Tu navegador no soporta video.
									</video>
								{:else if shareInfo.mimeType.startsWith('audio/')}
									<div class="audio-preview">
										<audio controls>
											<source src={downloadUrl} type={shareInfo.mimeType} />
											Tu navegador no soporta audio.
										</audio>
									</div>
								{:else if shareInfo.mimeType.includes('pdf')}
									<iframe src={downloadUrl} class="preview-pdf" title={shareInfo.fileName}></iframe>
								{/if}
							</div>
						{/if}

						<div class="actions">
							<button class="btn btn-primary btn-large" on:click={downloadFile}>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
									<polyline points="7 10 12 15 17 10"/>
									<line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
								Descargar archivo
							</button>
						</div>

						{#if shareInfo.maxDownloads}
							<p class="download-limit">
								Descargas: {shareInfo.downloadCount} / {shareInfo.maxDownloads}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<p class="footer">
			Compartido de forma segura con <a href="/">CloudImega</a>
		</p>
	</div>
</div>

<style>
	.share-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		padding: 20px;
	}

	.share-container {
		width: 100%;
		max-width: 600px;
	}

	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: var(--primary-light);
		font-size: 20px;
		font-weight: 600;
		margin-bottom: 32px;
	}

	.share-card {
		text-align: center;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		gap: 16px;
		color: var(--text-secondary);
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40px 20px;
		gap: 16px;
		color: var(--error);
	}

	.error-state h2 {
		color: var(--text);
		margin: 0;
	}

	.error-state p {
		color: var(--text-secondary);
	}

	/* Password Section */
	.password-section {
		padding: 20px 0;
	}

	.file-preview-locked {
		color: var(--text-muted);
		margin-bottom: 20px;
	}

	.password-section h2 {
		font-size: 20px;
		margin-bottom: 8px;
	}

	.password-section p {
		color: var(--text-secondary);
		margin-bottom: 24px;
	}

	.password-form {
		max-width: 300px;
		margin: 0 auto;
	}

	.password-form .input-group {
		margin-bottom: 16px;
	}

	.btn-full {
		width: 100%;
	}

	.spinner-sm {
		width: 18px;
		height: 18px;
		border-width: 2px;
	}

	/* File Section */
	.file-section {
		padding: 20px 0;
	}

	.file-icon-large {
		margin-bottom: 20px;
		color: var(--text-secondary);
	}

	.file-name {
		font-size: 20px;
		font-weight: 600;
		margin-bottom: 12px;
		word-break: break-word;
	}

	.file-meta {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin-bottom: 24px;
		flex-wrap: wrap;
	}

	/* Preview */
	.preview-container {
		margin-bottom: 24px;
		background: var(--bg);
		border-radius: 8px;
		overflow: hidden;
	}

	.preview-image {
		max-width: 100%;
		max-height: 400px;
		object-fit: contain;
	}

	.preview-video {
		width: 100%;
		max-height: 400px;
		background: black;
	}

	.audio-preview {
		padding: 40px 20px;
	}

	.audio-preview audio {
		width: 100%;
		max-width: 400px;
	}

	.preview-pdf {
		width: 100%;
		height: 500px;
		border: none;
	}

	.actions {
		margin-bottom: 16px;
	}

	.btn-large {
		padding: 14px 28px;
		font-size: 16px;
	}

	.download-limit {
		font-size: 13px;
		color: var(--text-muted);
	}

	.footer {
		text-align: center;
		margin-top: 24px;
		color: var(--text-muted);
		font-size: 13px;
	}

	.footer a {
		color: var(--primary-light);
	}
</style>
