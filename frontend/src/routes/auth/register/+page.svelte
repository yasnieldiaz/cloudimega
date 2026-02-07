<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let name = '';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let error = '';
	let isLoading = false;

	async function handleSubmit() {
		error = '';

		if (password !== confirmPassword) {
			error = 'Las contraseñas no coinciden';
			return;
		}

		if (password.length < 8) {
			error = 'La contraseña debe tener al menos 8 caracteres';
			return;
		}

		isLoading = true;

		const result = await auth.register(email, password, name);

		isLoading = false;

		if (result.success) {
			goto('/dashboard');
		} else {
			error = result.error || 'Error al registrarse';
		}
	}
</script>

<div class="auth-page">
	<!-- Animated Background -->
	<div class="animated-bg">
		<div class="wave wave1"></div>
		<div class="wave wave2"></div>
		<div class="wave wave3"></div>
		<div class="floating-shapes">
			<div class="shape shape1"></div>
			<div class="shape shape2"></div>
			<div class="shape shape3"></div>
			<div class="shape shape4"></div>
			<div class="shape shape5"></div>
		</div>
	</div>

	<div class="auth-container">
		<div class="auth-brand">
			<div class="brand-logo">
				<img src="/logo.png" alt="CloudImega" width="120" height="120" />
			</div>
			<h1>CloudImega</h1>
			<p>Crea tu cuenta gratuita</p>
		</div>

		<div class="auth-card card">
			<h2>Registro</h2>

			<form on:submit|preventDefault={handleSubmit}>
				<div class="input-group">
					<label for="name">Nombre</label>
					<input
						type="text"
						id="name"
						class="input"
						bind:value={name}
						placeholder="Tu nombre"
						required
						autocomplete="name"
					/>
				</div>

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
						autocomplete="new-password"
					/>
				</div>

				<div class="input-group">
					<label for="confirmPassword">Confirmar contraseña</label>
					<input
						type="password"
						id="confirmPassword"
						class="input"
						bind:value={confirmPassword}
						placeholder="••••••••"
						required
						autocomplete="new-password"
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
						Creando cuenta...
					{:else}
						Crear cuenta
					{/if}
				</button>
			</form>

			<div class="auth-divider">
				<span>o</span>
			</div>

			<p class="auth-switch">
				¿Ya tienes cuenta? <a href="/auth/login">Iniciar sesión</a>
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
		padding: 2rem;
		position: relative;
		overflow: hidden;
		background: linear-gradient(135deg, #0a1628 0%, #1a365d 50%, #0d2137 100%);
	}

	.animated-bg {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		z-index: 0;
	}

	.wave {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 200%;
		height: 100%;
		background: linear-gradient(180deg, transparent 50%, rgba(59, 130, 246, 0.1) 100%);
		border-radius: 100% 100% 0 0;
		animation: wave 8s ease-in-out infinite;
	}

	.wave1 {
		background: linear-gradient(180deg, transparent 60%, rgba(59, 130, 246, 0.15) 100%);
		animation-delay: 0s;
		animation-duration: 7s;
	}

	.wave2 {
		background: linear-gradient(180deg, transparent 65%, rgba(37, 99, 235, 0.1) 100%);
		animation-delay: -2s;
		animation-duration: 10s;
	}

	.wave3 {
		background: linear-gradient(180deg, transparent 70%, rgba(96, 165, 250, 0.08) 100%);
		animation-delay: -4s;
		animation-duration: 13s;
	}

	@keyframes wave {
		0%, 100% {
			transform: translateX(-50%) translateY(0) rotate(0deg);
		}
		50% {
			transform: translateX(-30%) translateY(-20px) rotate(2deg);
		}
	}

	.floating-shapes {
		position: absolute;
		width: 100%;
		height: 100%;
	}

	.shape {
		position: absolute;
		border-radius: 50%;
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.1));
		filter: blur(1px);
		animation: float 15s ease-in-out infinite;
	}

	.shape1 {
		width: 300px;
		height: 300px;
		top: -100px;
		right: -50px;
		animation-delay: 0s;
	}

	.shape2 {
		width: 200px;
		height: 200px;
		bottom: 10%;
		left: -50px;
		animation-delay: -3s;
		animation-duration: 18s;
	}

	.shape3 {
		width: 150px;
		height: 150px;
		top: 30%;
		right: 10%;
		animation-delay: -5s;
		animation-duration: 12s;
	}

	.shape4 {
		width: 100px;
		height: 100px;
		bottom: 30%;
		right: 20%;
		animation-delay: -7s;
		animation-duration: 20s;
	}

	.shape5 {
		width: 80px;
		height: 80px;
		top: 20%;
		left: 15%;
		animation-delay: -2s;
		animation-duration: 16s;
	}

	@keyframes float {
		0%, 100% {
			transform: translateY(0) rotate(0deg) scale(1);
			opacity: 0.6;
		}
		33% {
			transform: translateY(-30px) rotate(120deg) scale(1.1);
			opacity: 0.8;
		}
		66% {
			transform: translateY(20px) rotate(240deg) scale(0.9);
			opacity: 0.5;
		}
	}

	.auth-container {
		width: 100%;
		max-width: 420px;
		text-align: center;
		position: relative;
		z-index: 1;
	}

	.auth-brand {
		margin-bottom: 2rem;
	}

	.brand-logo {
		margin-bottom: 1rem;
		filter: drop-shadow(0 4px 20px rgba(59, 130, 246, 0.4));
	}

	.brand-logo img {
		border-radius: 20px;
	}

	.auth-brand h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 0.5rem;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
	}

	.auth-brand p {
		color: rgba(255, 255, 255, 0.8);
		font-size: 1rem;
	}

	.auth-card {
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(20px);
		border-radius: 20px;
		padding: 2.5rem;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
	}

	.auth-card h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1e293b;
		margin-bottom: 1.5rem;
	}

	.input-group {
		margin-bottom: 1rem;
		text-align: left;
	}

	.input-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #475569;
		margin-bottom: 0.5rem;
	}

	.input-group .input {
		width: 100%;
		padding: 0.875rem 1rem;
		font-size: 1rem;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		background: #ffffff;
		color: #1e293b;
		transition: all 0.2s ease;
	}

	.input-group .input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
	}

	.input-group .input::placeholder {
		color: #94a3b8;
	}

	.error-alert {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		color: #dc2626;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-primary {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
		color: white;
		box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
	}

	.btn-primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.btn-full {
		width: 100%;
	}

	.auth-divider {
		display: flex;
		align-items: center;
		margin: 1.5rem 0;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.auth-divider::before,
	.auth-divider::after {
		content: "";
		flex: 1;
		height: 1px;
		background: #e2e8f0;
	}

	.auth-divider span {
		padding: 0 1rem;
	}

	.auth-switch {
		color: #64748b;
		font-size: 0.875rem;
	}

	.auth-switch a {
		color: #3b82f6;
		font-weight: 600;
		text-decoration: none;
	}

	.auth-switch a:hover {
		text-decoration: underline;
	}

	.auth-footer {
		margin-top: 2rem;
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.75rem;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
