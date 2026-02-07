<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface Audio {
		id: string;
		name: string;
		path: string;
		size: number;
		mimeType: string;
		createdAt: string;
		updatedAt: string;
	}

	let audioFiles: Audio[] = [];
	let isLoading = true;
	let viewMode: 'list' | 'grid' = 'list';
	let selectedAudio: Set<string> = new Set();
	let currentlyPlaying: Audio | null = null;
	let audioElement: HTMLAudioElement | null = null;
	let isPlaying = false;
	let currentTime = 0;
	let duration = 0;
	let initialLoadDone = false;

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	$: if (!$auth.isLoading && $auth.isAuthenticated && !initialLoadDone) {
		initialLoadDone = true;
		loadAudio();
	}

	async function loadAudio() {
		isLoading = true;
		const token = api.getToken();

		try {
			const res = await fetch('/api/v1/files?perPage=1000', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (res.ok) {
				const response = await res.json();
				const allFiles = response.items || response || [];
				audioFiles = allFiles.filter((f: Audio) =>
					f.mimeType && f.mimeType.startsWith('audio/')
				).sort((a: Audio, b: Audio) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				);
			}
		} catch (e) {
			console.error('Error loading audio:', e);
		}

		isLoading = false;
	}

	function getAudioUrl(audio: Audio): string {
		const token = api.getToken();
		return `/api/v1/files/${audio.id}/download?token=${token}`;
	}

	function toggleSelect(audio: Audio, event: MouseEvent) {
		event.stopPropagation();
		if (selectedAudio.has(audio.id)) {
			selectedAudio.delete(audio.id);
		} else {
			selectedAudio.add(audio.id);
		}
		selectedAudio = selectedAudio;
	}

	function selectAll() {
		if (selectedAudio.size === audioFiles.length) {
			selectedAudio.clear();
		} else {
			audioFiles.forEach((a) => selectedAudio.add(a.id));
		}
		selectedAudio = selectedAudio;
	}

	function playAudio(audio: Audio) {
		if (currentlyPlaying?.id === audio.id) {
			if (isPlaying) {
				audioElement?.pause();
			} else {
				audioElement?.play();
			}
		} else {
			currentlyPlaying = audio;
			if (audioElement) {
				audioElement.src = getAudioUrl(audio);
				audioElement.play();
			}
		}
	}

	function handlePlay() {
		isPlaying = true;
	}

	function handlePause() {
		isPlaying = false;
	}

	function handleTimeUpdate() {
		if (audioElement) {
			currentTime = audioElement.currentTime;
			duration = audioElement.duration || 0;
		}
	}

	function handleEnded() {
		isPlaying = false;
		// Play next
		if (currentlyPlaying) {
			const currentIndex = audioFiles.findIndex(a => a.id === currentlyPlaying?.id);
			if (currentIndex < audioFiles.length - 1) {
				playAudio(audioFiles[currentIndex + 1]);
			}
		}
	}

	function seekTo(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const percent = (event.clientX - rect.left) / rect.width;
		if (audioElement && duration) {
			audioElement.currentTime = percent * duration;
		}
	}

	async function downloadSelected() {
		for (const id of selectedAudio) {
			const audio = audioFiles.find((a) => a.id === id);
			if (audio) {
				const a = document.createElement('a');
				a.href = getAudioUrl(audio);
				a.download = audio.name;
				a.click();
			}
		}
	}

	async function deleteSelected() {
		if (!confirm(`¿Eliminar ${selectedAudio.size} archivo(s) de audio?`)) return;

		const token = api.getToken();
		for (const id of selectedAudio) {
			try {
				await fetch(`/api/v1/files/${id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${token}` }
				});
			} catch (e) {
				console.error('Error deleting audio:', e);
			}
		}

		audioFiles = audioFiles.filter((a) => !selectedAudio.has(a.id));
		selectedAudio.clear();
		selectedAudio = selectedAudio;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('es-ES', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function formatTime(seconds: number): string {
		if (!seconds || isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="audio-page">
	<header class="page-header">
		<div class="header-left">
			<a href="/files" class="back-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12" />
					<polyline points="12 19 5 12 12 5" />
				</svg>
			</a>
			<h1>Audio</h1>
			<span class="item-count">{audioFiles.length} archivos</span>
		</div>

		<div class="header-center">
			{#if selectedAudio.size > 0}
				<div class="selection-actions">
					<span class="selection-count">{selectedAudio.size} seleccionados</span>
					<button class="btn btn-secondary btn-sm" on:click={downloadSelected}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
						Descargar
					</button>
					<button class="btn btn-danger btn-sm" on:click={deleteSelected}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="3 6 5 6 21 6" />
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
						</svg>
						Eliminar
					</button>
					<button class="btn-icon" on:click={() => { selectedAudio.clear(); selectedAudio = selectedAudio; }}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			{/if}
		</div>

		<div class="header-right">
			<button class="btn-icon" on:click={selectAll} title="Seleccionar todo">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
					{#if selectedAudio.size === audioFiles.length && audioFiles.length > 0}
						<polyline points="9 11 12 14 22 4" />
					{/if}
				</svg>
			</button>
			<div class="view-toggle">
				<button class="btn-view" class:active={viewMode === 'list'} on:click={() => (viewMode = 'list')} title="Lista">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="8" y1="6" x2="21" y2="6" />
						<line x1="8" y1="12" x2="21" y2="12" />
						<line x1="8" y1="18" x2="21" y2="18" />
						<line x1="3" y1="6" x2="3.01" y2="6" />
						<line x1="3" y1="12" x2="3.01" y2="12" />
						<line x1="3" y1="18" x2="3.01" y2="18" />
					</svg>
				</button>
				<button class="btn-view" class:active={viewMode === 'grid'} on:click={() => (viewMode = 'grid')} title="Cuadrícula">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="7" height="7" />
						<rect x="14" y="3" width="7" height="7" />
						<rect x="14" y="14" width="7" height="7" />
						<rect x="3" y="14" width="7" height="7" />
					</svg>
				</button>
			</div>
		</div>
	</header>

	<main class="page-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Cargando audio...</p>
			</div>
		{:else if audioFiles.length === 0}
			<div class="empty-state">
				<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<path d="M9 18V5l12-2v13" />
					<circle cx="6" cy="18" r="3" />
					<circle cx="18" cy="16" r="3" />
				</svg>
				<h2>No hay archivos de audio</h2>
				<p>Los archivos de audio que subas aparecerán aquí</p>
				<a href="/files" class="btn btn-primary">Ir a Archivos</a>
			</div>
		{:else if viewMode === 'list'}
			<div class="audio-list">
				{#each audioFiles as audio}
					<div class="audio-item" class:selected={selectedAudio.has(audio.id)} class:playing={currentlyPlaying?.id === audio.id}>
						<button class="select-checkbox" class:checked={selectedAudio.has(audio.id)} on:click={(e) => toggleSelect(audio, e)}>
							{#if selectedAudio.has(audio.id)}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</button>
						<button class="play-btn" on:click={() => playAudio(audio)}>
							{#if currentlyPlaying?.id === audio.id && isPlaying}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
									<rect x="6" y="4" width="4" height="16" />
									<rect x="14" y="4" width="4" height="16" />
								</svg>
							{:else}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
									<polygon points="5 3 19 12 5 21 5 3" />
								</svg>
							{/if}
						</button>
						<div class="audio-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M9 18V5l12-2v13" />
								<circle cx="6" cy="18" r="3" />
								<circle cx="18" cy="16" r="3" />
							</svg>
						</div>
						<div class="audio-info">
							<span class="audio-name">{audio.name}</span>
							<span class="audio-meta">{formatDate(audio.updatedAt)} • {formatSize(audio.size)}</span>
						</div>
						<a href={getAudioUrl(audio)} download={audio.name} class="btn-icon" title="Descargar">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="7 10 12 15 17 10" />
								<line x1="12" y1="15" x2="12" y2="3" />
							</svg>
						</a>
					</div>
				{/each}
			</div>
		{:else}
			<div class="audio-grid">
				{#each audioFiles as audio}
					<div class="audio-card" class:selected={selectedAudio.has(audio.id)} class:playing={currentlyPlaying?.id === audio.id}>
						<button class="select-checkbox" class:checked={selectedAudio.has(audio.id)} on:click={(e) => toggleSelect(audio, e)}>
							{#if selectedAudio.has(audio.id)}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</button>
						<button class="audio-card-icon" on:click={() => playAudio(audio)}>
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M9 18V5l12-2v13" />
								<circle cx="6" cy="18" r="3" />
								<circle cx="18" cy="16" r="3" />
							</svg>
							<div class="play-overlay-card">
								{#if currentlyPlaying?.id === audio.id && isPlaying}
									<svg width="32" height="32" viewBox="0 0 24 24" fill="white">
										<rect x="6" y="4" width="4" height="16" />
										<rect x="14" y="4" width="4" height="16" />
									</svg>
								{:else}
									<svg width="32" height="32" viewBox="0 0 24 24" fill="white">
										<polygon points="5 3 19 12 5 21 5 3" />
									</svg>
								{/if}
							</div>
						</button>
						<div class="audio-card-info">
							<span class="audio-name" title={audio.name}>{audio.name}</span>
							<span class="audio-meta">{formatSize(audio.size)}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>

	<!-- Audio Player Bar -->
	{#if currentlyPlaying}
		<div class="player-bar">
			<div class="player-track">
				<div class="track-info">
					<div class="track-icon">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M9 18V5l12-2v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="16" r="3" />
						</svg>
					</div>
					<div class="track-details">
						<span class="track-name">{currentlyPlaying.name}</span>
						<span class="track-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
					</div>
				</div>
				<div class="player-controls">
					<button class="control-btn" on:click={() => playAudio(currentlyPlaying!)}>
						{#if isPlaying}
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<rect x="6" y="4" width="4" height="16" />
								<rect x="14" y="4" width="4" height="16" />
							</svg>
						{:else}
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<polygon points="5 3 19 12 5 21 5 3" />
							</svg>
						{/if}
					</button>
				</div>
				<button class="progress-bar" on:click={seekTo}>
					<div class="progress-fill" style="width: {duration ? (currentTime / duration) * 100 : 0}%"></div>
				</button>
				<a href={getAudioUrl(currentlyPlaying)} download={currentlyPlaying.name} class="btn-icon" title="Descargar">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
				</a>
			</div>
		</div>
	{/if}
</div>

<!-- Hidden audio element -->
<audio
	bind:this={audioElement}
	on:play={handlePlay}
	on:pause={handlePause}
	on:timeupdate={handleTimeUpdate}
	on:ended={handleEnded}
></audio>

<style>
	.audio-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg);
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 24px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.header-left h1 {
		font-size: 20px;
		font-weight: 600;
	}

	.item-count {
		font-size: 14px;
		color: var(--text-muted);
	}

	.back-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		color: var(--text-secondary);
	}

	.back-link:hover {
		background: var(--bg-hover);
		color: var(--text);
	}

	.header-center {
		flex: 1;
		display: flex;
		justify-content: center;
	}

	.selection-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		background: var(--bg-card);
		border-radius: 8px;
	}

	.selection-count {
		font-size: 14px;
		font-weight: 500;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.view-toggle {
		display: flex;
		background: var(--bg-card);
		border-radius: 8px;
		padding: 4px;
	}

	.btn-view {
		padding: 8px;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-view.active {
		background: var(--primary);
		color: white;
	}

	.page-content {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
		padding-bottom: 100px;
	}

	.loading-state,
	.empty-state {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: var(--text-secondary);
	}

	.empty-state h2 {
		color: var(--text);
		margin: 0;
	}

	.empty-state p {
		margin: 0;
	}

	/* List View */
	.audio-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.audio-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-card);
		border-radius: 8px;
		transition: background 0.2s;
	}

	.audio-item:hover {
		background: var(--bg-hover);
	}

	.audio-item.selected {
		background: var(--primary-light);
	}

	.audio-item.playing {
		background: linear-gradient(135deg, var(--primary-light), var(--bg-card));
	}

	.play-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--primary);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.audio-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		color: var(--primary);
	}

	.audio-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.audio-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.audio-meta {
		font-size: 13px;
		color: var(--text-muted);
	}

	/* Grid View */
	.audio-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 16px;
	}

	.audio-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 24px 16px 16px;
		background: var(--bg-card);
		border-radius: 12px;
		transition: background 0.2s, transform 0.2s;
	}

	.audio-card:hover {
		background: var(--bg-hover);
		transform: translateY(-2px);
	}

	.audio-card.selected {
		background: var(--primary-light);
	}

	.audio-card.playing {
		background: linear-gradient(135deg, var(--primary-light), var(--bg-card));
	}

	.audio-card-icon {
		position: relative;
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--primary), #8b5cf6);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
		border: none;
		cursor: pointer;
		color: white;
	}

	.play-overlay-card {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 50%;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.audio-card:hover .play-overlay-card,
	.audio-card.playing .play-overlay-card {
		opacity: 1;
	}

	.audio-card-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 100%;
	}

	.audio-card-info .audio-name {
		text-align: center;
		max-width: 100%;
	}

	.audio-card .select-checkbox {
		position: absolute;
		top: 8px;
		left: 8px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.audio-card:hover .select-checkbox,
	.select-checkbox.checked {
		opacity: 1;
	}

	.select-checkbox {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.select-checkbox.checked {
		background: var(--primary);
		border-color: var(--primary);
	}

	.select-checkbox svg {
		color: white;
	}

	/* Player Bar */
	.player-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-card);
		border-top: 1px solid var(--border);
		padding: 12px 24px;
		z-index: 50;
	}

	.player-track {
		display: flex;
		align-items: center;
		gap: 16px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.track-info {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 200px;
	}

	.track-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: var(--primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.track-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.track-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track-time {
		font-size: 12px;
		color: var(--text-muted);
	}

	.player-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.control-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--primary);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.progress-bar {
		flex: 1;
		height: 6px;
		background: var(--bg-secondary);
		border-radius: 3px;
		cursor: pointer;
		border: none;
		padding: 0;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 3px;
		transition: width 0.1s linear;
	}

	@media (max-width: 768px) {
		.audio-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}

		.audio-card .select-checkbox {
			opacity: 1;
		}

		.track-info {
			min-width: 120px;
		}

		.track-name {
			max-width: 100px;
		}
	}
</style>
