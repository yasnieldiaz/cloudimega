<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { theme } from '$lib/stores/theme';
	import { goto } from '$app/navigation';
	import { api, type TwoFactorStatus, type TwoFactorSetup, type ActivityLog } from '$lib/api/client';

	// 2FA State
	let twoFactorStatus: TwoFactorStatus | null = null;
	let twoFactorSetup: TwoFactorSetup | null = null;
	let verificationCode = '';
	let isSettingUp2FA = false;
	let isVerifying = false;
	let backupCodes: string[] = [];
	let showBackupCodes = false;
	let backupCodesCount = 0;
	let disablePassword = '';
	let disableCode = '';
	let isDisabling = false;

	// Activity State
	let activityLogs: ActivityLog[] = [];
	let isLoadingActivity = false;
	let activityPage = 1;
	let hasMoreActivity = true;

	// Tabs
	let activeTab: 'security' | 'activity' | 'preferences' = 'security';

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	onMount(async () => {
		theme.init();
		if ($auth.isAuthenticated) {
			await load2FAStatus();
			await loadActivity();
		}
	});

	async function load2FAStatus() {
		const { data } = await api.get2FAStatus();
		if (data) {
			twoFactorStatus = data;
			if (data.isEnabled) {
				const countResult = await api.getBackupCodesCount();
				if (countResult.data) {
					backupCodesCount = countResult.data.remainingCount;
				}
			}
		}
	}

	async function start2FASetup() {
		isSettingUp2FA = true;
		const { data, error } = await api.setup2FA();
		if (data) {
			twoFactorSetup = data;
		} else {
			alert(error || 'Error al configurar 2FA');
		}
		isSettingUp2FA = false;
	}

	async function verify2FA() {
		if (!verificationCode || verificationCode.length !== 6) {
			alert('Introduce un codigo de 6 digitos');
			return;
		}

		isVerifying = true;
		const { data, error } = await api.verify2FA(verificationCode);
		if (data?.success) {
			backupCodes = data.backupCodes || [];
			showBackupCodes = true;
			twoFactorSetup = null;
			verificationCode = '';
			await load2FAStatus();
		} else {
			alert(error || 'Codigo incorrecto');
		}
		isVerifying = false;
	}

	async function disable2FA() {
		if (!disableCode || !disablePassword) {
			alert('Introduce el codigo y tu contrasena');
			return;
		}

		isDisabling = true;
		const { error } = await api.disable2FA(disableCode, disablePassword);
		if (!error) {
			twoFactorStatus = { isEnabled: false, isVerified: false };
			disableCode = '';
			disablePassword = '';
			alert('2FA desactivado correctamente');
		} else {
			alert(error || 'Error al desactivar 2FA');
		}
		isDisabling = false;
	}

	async function regenerateBackupCodes() {
		const code = prompt('Introduce tu codigo 2FA actual:');
		if (!code) return;

		const { data, error } = await api.regenerateBackupCodes(code);
		if (data) {
			backupCodes = data.backupCodes;
			showBackupCodes = true;
			await load2FAStatus();
		} else {
			alert(error || 'Error al regenerar codigos');
		}
	}

	async function loadActivity() {
		isLoadingActivity = true;
		const { data } = await api.getActivity({ page: activityPage, perPage: 20 });
		if (data) {
			activityLogs = [...activityLogs, ...data.items];
			hasMoreActivity = data.items.length === 20;
		}
		isLoadingActivity = false;
	}

	async function loadMoreActivity() {
		activityPage++;
		await loadActivity();
	}

	function getActionIcon(action: string): string {
		switch (action) {
			case 'created': return 'M12 4v16m-8-8h16';
			case 'updated': return 'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
			case 'deleted': return 'M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16';
			case 'downloaded': return 'M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4';
			case 'shared': return 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 0 5.367-2.684 3 3 0 0 0-5.367 2.684zm0 9.316a3 3 0 1 0 5.368 2.684 3 3 0 0 0-5.368-2.684z';
			case 'favorited': return 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 0 0 .95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 0 0-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 0 0-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 0 0-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 0 0 .951-.69l1.519-4.674z';
			default: return 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z';
		}
	}

	function formatActivityDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Ahora mismo';
		if (minutes < 60) return `hace ${minutes} min`;
		if (hours < 24) return `hace ${hours}h`;
		if (days < 7) return `hace ${days} dias`;
		return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
	}

	function getActionLabel(action: string): string {
		const labels: Record<string, string> = {
			created: 'Creado',
			updated: 'Modificado',
			deleted: 'Eliminado',
			downloaded: 'Descargado',
			shared: 'Compartido',
			viewed: 'Visto',
			favorited: 'Marcado favorito',
			unfavorited: 'Desmarcado favorito',
			restored: 'Restaurado'
		};
		return labels[action] || action;
	}

	function copyBackupCodes() {
		navigator.clipboard.writeText(backupCodes.join('\n'));
		alert('Codigos copiados al portapapeles');
	}
</script>

<div class="settings-layout">
	<aside class="settings-sidebar">
		<a href="/files" class="back-link">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
			Volver a Archivos
		</a>

		<h1>Configuracion</h1>

		<nav class="settings-nav">
			<button class="nav-item" class:active={activeTab === 'security'} on:click={() => activeTab = 'security'}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
				</svg>
				Seguridad
			</button>
			<button class="nav-item" class:active={activeTab === 'activity'} on:click={() => activeTab = 'activity'}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
				</svg>
				Actividad
			</button>
			<button class="nav-item" class:active={activeTab === 'preferences'} on:click={() => activeTab = 'preferences'}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"/>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
				</svg>
				Preferencias
			</button>
		</nav>
	</aside>

	<main class="settings-content">
		{#if activeTab === 'security'}
			<section class="settings-section">
				<h2>Autenticacion de dos factores (2FA)</h2>
				<p class="section-description">
					Anade una capa extra de seguridad a tu cuenta usando una aplicacion de autenticacion.
				</p>

				{#if showBackupCodes && backupCodes.length > 0}
					<div class="backup-codes-modal">
						<div class="backup-codes-content">
							<h3>Codigos de respaldo</h3>
							<p>Guarda estos codigos en un lugar seguro. Cada codigo solo puede usarse una vez.</p>
							<div class="codes-grid">
								{#each backupCodes as code}
									<code class="backup-code">{code}</code>
								{/each}
							</div>
							<div class="backup-actions">
								<button class="btn btn-secondary" on:click={copyBackupCodes}>
									Copiar codigos
								</button>
								<button class="btn btn-primary" on:click={() => { showBackupCodes = false; backupCodes = []; }}>
									Ya los guarde
								</button>
							</div>
						</div>
					</div>
				{:else if !twoFactorStatus?.isEnabled}
					{#if twoFactorSetup}
						<div class="setup-2fa-form">
							<div class="qr-section">
								<img src={twoFactorSetup.qrCodeURL} alt="QR Code" class="qr-code" />
								<p class="qr-hint">Escanea este codigo QR con tu aplicacion de autenticacion (Google Authenticator, Authy, etc.)</p>
								<details class="manual-entry">
									<summary>No puedes escanear? Introduce manualmente</summary>
									<code class="secret-key">{twoFactorSetup.secret}</code>
								</details>
							</div>

							<div class="verify-section">
								<label for="verify-code">Introduce el codigo de 6 digitos:</label>
								<input
									id="verify-code"
									type="text"
									class="input verification-input"
									bind:value={verificationCode}
									maxlength="6"
									placeholder="000000"
									on:keypress={(e) => e.key === 'Enter' && verify2FA()}
								/>
								<button class="btn btn-primary" on:click={verify2FA} disabled={isVerifying}>
									{isVerifying ? 'Verificando...' : 'Verificar y activar'}
								</button>
							</div>
						</div>
					{:else}
						<div class="enable-2fa">
							<div class="status-badge disabled">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<line x1="15" y1="9" x2="9" y2="15"/>
									<line x1="9" y1="9" x2="15" y2="15"/>
								</svg>
								2FA desactivado
							</div>
							<button class="btn btn-primary" on:click={start2FASetup} disabled={isSettingUp2FA}>
								{isSettingUp2FA ? 'Configurando...' : 'Activar 2FA'}
							</button>
						</div>
					{/if}
				{:else}
					<div class="twofa-enabled">
						<div class="status-badge enabled">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
								<polyline points="22 4 12 14.01 9 11.01"/>
							</svg>
							2FA activado
						</div>

						<div class="backup-codes-info">
							<p>Codigos de respaldo disponibles: <strong>{backupCodesCount}</strong></p>
							<button class="btn btn-secondary btn-sm" on:click={regenerateBackupCodes}>
								Regenerar codigos
							</button>
						</div>

						<div class="disable-section">
							<h4>Desactivar 2FA</h4>
							<div class="disable-form">
								<input
									type="password"
									class="input"
									bind:value={disablePassword}
									placeholder="Tu contrasena"
								/>
								<input
									type="text"
									class="input"
									bind:value={disableCode}
									placeholder="Codigo 2FA o backup"
									maxlength="8"
								/>
								<button class="btn btn-danger" on:click={disable2FA} disabled={isDisabling}>
									{isDisabling ? 'Desactivando...' : 'Desactivar 2FA'}
								</button>
							</div>
						</div>
					</div>
				{/if}
			</section>

		{:else if activeTab === 'activity'}
			<section class="settings-section">
				<h2>Registro de actividad</h2>
				<p class="section-description">
					Historial de acciones realizadas en tu cuenta.
				</p>

				<div class="activity-list">
					{#each activityLogs as log}
						<div class="activity-item">
							<div class="activity-icon">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d={getActionIcon(log.action)}/>
								</svg>
							</div>
							<div class="activity-content">
								<span class="activity-action">{getActionLabel(log.action)}</span>
								<span class="activity-resource">{log.resourceName}</span>
								<span class="activity-meta">
									{formatActivityDate(log.createdAt)}
									{#if log.ipAddress} - {log.ipAddress}{/if}
								</span>
							</div>
						</div>
					{/each}

					{#if activityLogs.length === 0 && !isLoadingActivity}
						<div class="empty-activity">
							<p>No hay actividad registrada</p>
						</div>
					{/if}

					{#if isLoadingActivity}
						<div class="loading-activity">
							<div class="spinner"></div>
						</div>
					{/if}

					{#if hasMoreActivity && !isLoadingActivity && activityLogs.length > 0}
						<button class="btn btn-secondary load-more" on:click={loadMoreActivity}>
							Cargar mas
						</button>
					{/if}
				</div>
			</section>

		{:else if activeTab === 'preferences'}
			<section class="settings-section">
				<h2>Preferencias</h2>

				<div class="preference-item">
					<div class="preference-info">
						<h4>Tema</h4>
						<p>Elige entre modo claro y oscuro</p>
					</div>
					<button class="btn btn-secondary" on:click={() => theme.toggle()}>
						{$theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
					</button>
				</div>

				<div class="preference-item">
					<div class="preference-info">
						<h4>Cuenta</h4>
						<p>Email: {$auth.user?.email}</p>
					</div>
				</div>

				<div class="preference-item">
					<div class="preference-info">
						<h4>Almacenamiento</h4>
						<p>
							{Math.round(($auth.user?.storageUsed || 0) / 1024 / 1024)} MB de {Math.round(($auth.user?.storageQuota || 0) / 1024 / 1024 / 1024)} GB usados
						</p>
					</div>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.settings-layout {
		display: flex;
		min-height: 100vh;
	}

	.settings-sidebar {
		width: 280px;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border);
		padding: 24px;
		flex-shrink: 0;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 14px;
		margin-bottom: 24px;
	}

	.back-link:hover {
		color: var(--text);
	}

	.settings-sidebar h1 {
		font-size: 24px;
		margin-bottom: 24px;
	}

	.settings-nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: none;
		border: none;
		border-radius: 8px;
		color: var(--text-secondary);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all 0.15s;
	}

	.nav-item:hover {
		background: var(--bg-hover);
		color: var(--text);
	}

	.nav-item.active {
		background: var(--primary);
		color: white;
	}

	.settings-content {
		flex: 1;
		padding: 40px;
		max-width: 800px;
	}

	.settings-section {
		margin-bottom: 40px;
	}

	.settings-section h2 {
		font-size: 20px;
		margin-bottom: 8px;
	}

	.section-description {
		color: var(--text-secondary);
		margin-bottom: 24px;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 20px;
		font-weight: 500;
	}

	.status-badge.enabled {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
	}

	.status-badge.disabled {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.enable-2fa {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.setup-2fa-form {
		display: grid;
		gap: 30px;
		max-width: 500px;
	}

	.qr-section {
		text-align: center;
	}

	.qr-code {
		width: 200px;
		height: 200px;
		border-radius: 8px;
		background: white;
		padding: 10px;
	}

	.qr-hint {
		margin-top: 12px;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.manual-entry {
		margin-top: 16px;
		font-size: 13px;
	}

	.secret-key {
		display: block;
		margin-top: 8px;
		padding: 12px;
		background: var(--bg-secondary);
		border-radius: 6px;
		word-break: break-all;
		font-size: 14px;
	}

	.verify-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.verification-input {
		font-size: 24px;
		text-align: center;
		letter-spacing: 8px;
		max-width: 200px;
	}

	.twofa-enabled {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.backup-codes-info {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px;
		background: var(--bg-secondary);
		border-radius: 8px;
	}

	.disable-section {
		padding-top: 24px;
		border-top: 1px solid var(--border);
	}

	.disable-section h4 {
		margin-bottom: 12px;
		color: var(--text-secondary);
	}

	.disable-form {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.disable-form .input {
		flex: 1;
		min-width: 150px;
	}

	.backup-codes-modal {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.backup-codes-content {
		background: var(--bg-card);
		padding: 30px;
		border-radius: 16px;
		max-width: 450px;
		text-align: center;
	}

	.backup-codes-content h3 {
		margin-bottom: 12px;
	}

	.backup-codes-content p {
		color: var(--text-secondary);
		margin-bottom: 20px;
		font-size: 14px;
	}

	.codes-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		margin-bottom: 20px;
	}

	.backup-code {
		padding: 10px;
		background: var(--bg-secondary);
		border-radius: 6px;
		font-size: 14px;
	}

	.backup-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
	}

	/* Activity */
	.activity-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	.activity-item {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 16px;
		background: var(--bg-card);
	}

	.activity-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		flex-shrink: 0;
	}

	.activity-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.activity-action {
		font-weight: 500;
	}

	.activity-resource {
		color: var(--primary);
		font-size: 14px;
	}

	.activity-meta {
		font-size: 12px;
		color: var(--text-muted);
	}

	.empty-activity, .loading-activity {
		padding: 40px;
		text-align: center;
		background: var(--bg-card);
	}

	.load-more {
		width: 100%;
		border-radius: 0;
	}

	/* Preferences */
	.preference-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 0;
		border-bottom: 1px solid var(--border);
	}

	.preference-info h4 {
		margin-bottom: 4px;
	}

	.preference-info p {
		font-size: 14px;
		color: var(--text-secondary);
	}

	@media (max-width: 768px) {
		.settings-layout {
			flex-direction: column;
		}

		.settings-sidebar {
			width: 100%;
			border-right: none;
			border-bottom: 1px solid var(--border);
		}

		.settings-nav {
			flex-direction: row;
			overflow-x: auto;
		}

		.nav-item {
			white-space: nowrap;
		}
	}
</style>
