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
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}

		isLoading = true;

		const result = await auth.register(email, password, name);

		isLoading = false;

		if (result.success) {
			goto('/dashboard');
		} else {
			error = result.error || 'Registration failed';
		}
	}
</script>

<div class="auth-page">
	<div class="auth-card card">
		<div class="logo">
			<img src="/logo.png" alt="CloudImega" width="80" height="80" />
			<h1>CloudImega</h1>
			<p>Crea tu cuenta</p>
		</div>

		<form on:submit|preventDefault={handleSubmit}>
			<div class="form-group">
				<label for="name">Name</label>
				<input
					type="text"
					id="name"
					class="input"
					bind:value={name}
					placeholder="Your name"
					required
				/>
			</div>

			<div class="form-group">
				<label for="email">Email</label>
				<input
					type="email"
					id="email"
					class="input"
					bind:value={email}
					placeholder="you@example.com"
					required
				/>
			</div>

			<div class="form-group">
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					class="input"
					bind:value={password}
					placeholder="At least 8 characters"
					required
				/>
			</div>

			<div class="form-group">
				<label for="confirmPassword">Confirm Password</label>
				<input
					type="password"
					id="confirmPassword"
					class="input"
					bind:value={confirmPassword}
					placeholder="Repeat your password"
					required
				/>
			</div>

			{#if error}
				<p class="error-message">{error}</p>
			{/if}

			<button type="submit" class="btn btn-primary btn-full" disabled={isLoading}>
				{isLoading ? 'Creating account...' : 'Create Account'}
			</button>
		</form>

		<p class="auth-switch">
			Already have an account? <a href="/auth/login">Sign in</a>
		</p>
	</div>
</div>

<style>
	.auth-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
		padding: 20px;
	}

	.auth-card {
		width: 100%;
		max-width: 400px;
	}

	.logo {
		text-align: center;
		margin-bottom: 30px;
	}

	.logo h1 {
		font-size: 2rem;
		background: linear-gradient(135deg, var(--primary), var(--secondary));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.logo p {
		color: var(--text-secondary);
		margin-top: 8px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
	}

	.btn-full {
		width: 100%;
		margin-top: 10px;
	}

	.auth-switch {
		text-align: center;
		margin-top: 20px;
		color: var(--text-secondary);
	}
</style>
