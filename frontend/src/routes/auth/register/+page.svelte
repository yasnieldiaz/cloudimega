<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let name = '';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let error = '';
	let isLoading = false;
	let canvas: HTMLCanvasElement;
	let animationId: number;

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

	// Particle Network Animation
	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let particles: Array<{x: number, y: number, vx: number, vy: number, radius: number}> = [];
		const particleCount = 80;
		const connectionDistance = 150;
		const mouseRadius = 200;
		let mouse = { x: -1000, y: -1000 };

		function resize() {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		}

		function createParticles() {
			particles = [];
			for (let i = 0; i < particleCount; i++) {
				particles.push({
					x: Math.random() * canvas.width,
					y: Math.random() * canvas.height,
					vx: (Math.random() - 0.5) * 0.25,
					vy: (Math.random() - 0.5) * 0.25,
					radius: Math.random() * 2 + 1
				});
			}
		}

		function animate() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			particles.forEach((p, i) => {
				p.x += p.vx;
				p.y += p.vy;

				if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
				if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

				const dx = mouse.x - p.x;
				const dy = mouse.y - p.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < mouseRadius) {
					const force = (mouseRadius - dist) / mouseRadius;
					p.vx -= dx * force * 0.02;
					p.vy -= dy * force * 0.02;
				}

				ctx.beginPath();
				ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
				ctx.fill();

				for (let j = i + 1; j < particles.length; j++) {
					const p2 = particles[j];
					const dx = p.x - p2.x;
					const dy = p.y - p2.y;
					const distance = Math.sqrt(dx * dx + dy * dy);

					if (distance < connectionDistance) {
						const opacity = 1 - (distance / connectionDistance);
						ctx.beginPath();
						ctx.moveTo(p.x, p.y);
						ctx.lineTo(p2.x, p2.y);
						ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.4})`;
						ctx.lineWidth = 1;
						ctx.stroke();
					}
				}
			});

			animationId = requestAnimationFrame(animate);
		}

		function handleMouseMove(e: MouseEvent) {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
		}

		function handleMouseLeave() {
			mouse.x = -1000;
			mouse.y = -1000;
		}

		window.addEventListener('resize', resize);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseleave', handleMouseLeave);

		resize();
		createParticles();
		animate();

		return () => {
			window.removeEventListener('resize', resize);
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseleave', handleMouseLeave);
			if (animationId) cancelAnimationFrame(animationId);
		};
	});

	onDestroy(() => {
		if (animationId) cancelAnimationFrame(animationId);
	});
</script>

<div class="auth-page">
	<canvas bind:this={canvas} class="particle-canvas"></canvas>

	<div class="auth-container">
		<div class="auth-brand">
			<div class="brand-logo">
				<img src="/logo.png" alt="CloudImega" width="200" height="200" />
			</div>
			<h1>CloudImega</h1>
			<p>Crea tu cuenta gratuita</p>
		</div>

		<div class="auth-card card">
			<h2>Registro</h2>

			<form on:submit|preventDefault={handleSubmit}>
				<div class="input-group">
					<label for="name">Nombre</label>
					<input type="text" id="name" class="input" bind:value={name} placeholder="Tu nombre" required autocomplete="name" />
				</div>

				<div class="input-group">
					<label for="email">Correo electrónico</label>
					<input type="email" id="email" class="input" bind:value={email} placeholder="tu@email.com" required autocomplete="email" />
				</div>

				<div class="input-group">
					<label for="password">Contraseña</label>
					<input type="password" id="password" class="input" bind:value={password} placeholder="••••••••" required autocomplete="new-password" />
				</div>

				<div class="input-group">
					<label for="confirmPassword">Confirmar contraseña</label>
					<input type="password" id="confirmPassword" class="input" bind:value={confirmPassword} placeholder="••••••••" required autocomplete="new-password" />
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

			<div class="auth-divider"><span>o</span></div>

			<p class="auth-switch">
				¿Ya tienes cuenta? <a href="/auth/login">Iniciar sesión</a>
			</p>
		</div>

		<p class="auth-footer">CloudImega &copy; 2026. Almacenamiento seguro en la nube.</p>
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
		background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #8b5cf6 100%);
	}

	.particle-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	.auth-container {
		width: 100%;
		max-width: 420px;
		text-align: center;
		position: relative;
		z-index: 1;
	}

	.auth-brand { margin-bottom: 2rem; }
	.brand-logo { margin-bottom: 1rem; filter: drop-shadow(0 4px 20px rgba(59, 130, 246, 0.5)); }
	.brand-logo img { border-radius: 20px; }
	.auth-brand h1 { font-size: 2rem; font-weight: 700; color: #ffffff; margin-bottom: 0.5rem; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); }
	.auth-brand p { color: rgba(255, 255, 255, 0.9); font-size: 1rem; }

	.auth-card {
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(20px);
		border-radius: 20px;
		padding: 2rem;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
	}

	.auth-card h2 { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin-bottom: 1.5rem; }
	.input-group { margin-bottom: 1rem; text-align: left; }
	.input-group label { display: block; font-size: 0.875rem; font-weight: 500; color: #475569; margin-bottom: 0.5rem; }
	.input-group .input {
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		background: #ffffff;
		color: #1e293b;
		transition: all 0.2s ease;
	}
	.input-group .input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); }
	.input-group .input::placeholder { color: #94a3b8; }

	.error-alert {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
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
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		color: white;
		box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
	}

	.btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5); }
	.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
	.btn-full { width: 100%; }

	.auth-divider { display: flex; align-items: center; margin: 1.5rem 0; color: #94a3b8; font-size: 0.875rem; }
	.auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; }
	.auth-divider span { padding: 0 1rem; }

	.auth-switch { color: #64748b; font-size: 0.875rem; }
	.auth-switch a { color: #3b82f6; font-weight: 600; text-decoration: none; }
	.auth-switch a:hover { text-decoration: underline; }
	.auth-footer { margin-top: 2rem; color: rgba(255, 255, 255, 0.7); font-size: 0.75rem; }

	.spinner { width: 20px; height: 20px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
