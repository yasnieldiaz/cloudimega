<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let error = '';
	let isLoading = false;

	async function handleSubmit() {
		error = '';
		isLoading = true;

		const result = await auth.login(email, password);

		isLoading = false;

		if (result.success) {
			goto('/dashboard');
		} else {
			error = result.error || 'Error al iniciar sesión';
		}
	}
</script>

<div class="auth-page">
	<div class="auth-container">
		<div class="auth-brand">
			<div class="brand-logo">
				<img src="/logo.png" alt="CloudImega" width="80" height="80" />
			</div>
			<h1>CloudImega</h1>
			<p>Tu nube personal, rapida y segura</p>
		</div>

		<div class="auth-card card">
			<h2>Iniciar sesión</h2>

			<form on:submit|preventDefault={handleSubmit}>
				<div class="input-group">
					<label for="email">Correo electrónico</label>
					<input
						type="email"
						id="email"
						class="input"
						bind:value={email}
						placeholder="tu@email.com"
						required
						autocomplete="email"
					/>
				</div>

				<div class="input-group">
					<label for="password">Contraseña</label>
					<input
						type="password"
						id="password"
						class="input"
						bind:value={password}
						placeholder="••••••••"
						required
						autocomplete="current-password"
					/>
				</div>

				{#if error}
					<div class="error-alert">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"/>
							<line x1="15" y1="9" x2="9" y2="15"/>
							<line x1="9" y1="9" x2="15" y2="15"/>
						</svg>
						{error}
					</div>
				{/if}

				<button type="submit" class="btn btn-primary btn-full" disabled={isLoading}>
					{#if isLoading}
						<div class="spinner spinner-sm"></div>
						Iniciando sesión...
					{:else}
						Iniciar sesión
					{/if}
				</button>
			</form>

			<div class="auth-divider">
				<span>o</span>
			</div>

			<p class="auth-switch">
				¿No tienes cuenta? <a href="/auth/register">Crear cuenta</a>
			</p>
		</div>

		<p class="auth-footer">
			CloudImega &copy; 2026. Almacenamiento seguro en la nube.
		</p>
	</div>
</div>

<style>
	.auth-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		padding: 20px;
	}

	.auth-container {
		width: 100%;
		max-width: 400px;
	}

	.auth-brand {
		text-align: center;
		margin-bottom: 32px;
		color: var(--primary-light);
	}

	.brand-logo {
		margin-bottom: 16px;
	}

	.auth-brand h1 {
		font-size: 28px;
		font-weight: 700;
		margin-bottom: 8px;
	}

	.auth-brand p {
		color: var(--text-secondary);
		font-size: 14px;
	}

	.auth-card {
		background: var(--bg-card);
	}

	.auth-card h2 {
		font-size: 20px;
		font-weight: 600;
		margin-bottom: 24px;
		text-align: center;
	}

	.input-group {
		margin-bottom: 20px;
	}

	.input-group label {
		display: block;
		margin-bottom: 8px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.error-alert {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: rgba(233, 50, 45, 0.1);
		border: 1px solid var(--error);
		border-radius: 8px;
		color: var(--error);
		font-size: 14px;
		margin-bottom: 20px;
	}

	.btn-full {
		width: 100%;
		padding: 12px;
		font-size: 15px;
	}

	.spinner-sm {
		width: 18px;
		height: 18px;
		border-width: 2px;
	}

	.auth-divider {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 24px 0;
		color: var(--text-muted);
		font-size: 12px;
	}

	.auth-divider::before,
	.auth-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.auth-switch {
		text-align: center;
		color: var(--text-secondary);
		font-size: 14px;
	}

	.auth-switch a {
		color: var(--primary-light);
		font-weight: 500;
	}

	.auth-switch a:hover {
		text-decoration: underline;
	}

	.auth-footer {
		text-align: center;
		margin-top: 24px;
		color: var(--text-muted);
		font-size: 12px;
	}
</style>
