<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface Video {
		id: string;
		name: string;
		path: string;
		size: number;
		mimeType: string;
		createdAt: string;
		updatedAt: string;
	}

	let videos: Video[] = [];
	let isLoading = true;
	let viewMode: 'grid' | 'list' = 'grid';
	let selectedVideos: Set<string> = new Set();
	let selectedVideo: Video | null = null;
	let showPlayer = false;
	let initialLoadDone = false;

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	$: if (!$auth.isLoading && $auth.isAuthenticated && !initialLoadDone) {
		initialLoadDone = true;
		loadVideos();
	}

	async function loadVideos() {
		isLoading = true;
		const token = api.getToken();

		try {
			const res = await fetch('/api/v1/files?perPage=1000', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (res.ok) {
				const response = await res.json();
				const allFiles = response.items || response || [];
				videos = allFiles.filter((f: Video) =>
					f.mimeType && f.mimeType.startsWith('video/')
				).sort((a: Video, b: Video) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				);
			}
		} catch (e) {
			console.error('Error loading videos:', e);
		}

		isLoading = false;
	}

	function getVideoUrl(video: Video): string {
		const token = api.getToken();
		return `/api/v1/files/${video.id}/download?token=${token}`;
	}

	function toggleSelect(video: Video, event: MouseEvent) {
		event.stopPropagation();
		if (selectedVideos.has(video.id)) {
			selectedVideos.delete(video.id);
		} else {
			selectedVideos.add(video.id);
		}
		selectedVideos = selectedVideos;
	}

	function selectAll() {
		if (selectedVideos.size === videos.length) {
			selectedVideos.clear();
		} else {
			videos.forEach((v) => selectedVideos.add(v.id));
		}
		selectedVideos = selectedVideos;
	}

	function openPlayer(video: Video) {
		selectedVideo = video;
		showPlayer = true;
	}

	function closePlayer() {
		showPlayer = false;
		selectedVideo = null;
	}

	async function downloadSelected() {
		for (const id of selectedVideos) {
			const video = videos.find((v) => v.id === id);
			if (video) {
				const a = document.createElement('a');
				a.href = getVideoUrl(video);
				a.download = video.name;
				a.click();
			}
		}
	}

	async function deleteSelected() {
		if (!confirm(`¿Eliminar ${selectedVideos.size} video(s)?`)) return;

		const token = api.getToken();
		for (const id of selectedVideos) {
			try {
				await fetch(`/api/v1/files/${id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${token}` }
				});
			} catch (e) {
				console.error('Error deleting video:', e);
			}
		}

		videos = videos.filter((v) => !selectedVideos.has(v.id));
		selectedVideos.clear();
		selectedVideos = selectedVideos;
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
		if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
		return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showPlayer) return;
		if (event.key === 'Escape') closePlayer();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="videos-page">
	<header class="page-header">
		<div class="header-left">
			<a href="/files" class="back-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12" />
					<polyline points="12 19 5 12 12 5" />
				</svg>
			</a>
			<h1>Videos</h1>
			<span class="item-count">{videos.length} videos</span>
		</div>

		<div class="header-center">
			{#if selectedVideos.size > 0}
				<div class="selection-actions">
					<span class="selection-count">{selectedVideos.size} seleccionados</span>
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
					<button class="btn-icon" on:click={() => { selectedVideos.clear(); selectedVideos = selectedVideos; }}>
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
					{#if selectedVideos.size === videos.length && videos.length > 0}
						<polyline points="9 11 12 14 22 4" />
					{/if}
				</svg>
			</button>
			<div class="view-toggle">
				<button class="btn-view" class:active={viewMode === 'grid'} on:click={() => (viewMode = 'grid')} title="Cuadrícula">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="7" height="7" />
						<rect x="14" y="3" width="7" height="7" />
						<rect x="14" y="14" width="7" height="7" />
						<rect x="3" y="14" width="7" height="7" />
					</svg>
				</button>
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
			</div>
		</div>
	</header>

	<main class="page-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Cargando videos...</p>
			</div>
		{:else if videos.length === 0}
			<div class="empty-state">
				<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<polygon points="23 7 16 12 23 17 23 7" />
					<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
				</svg>
				<h2>No hay videos</h2>
				<p>Los videos que subas aparecerán aquí</p>
				<a href="/files" class="btn btn-primary">Ir a Archivos</a>
			</div>
		{:else if viewMode === 'grid'}
			<div class="video-grid">
				{#each videos as video}
					<div class="video-card" class:selected={selectedVideos.has(video.id)}>
						<button class="video-wrapper" on:click={() => openPlayer(video)}>
							<div class="video-thumbnail">
								<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<polygon points="23 7 16 12 23 17 23 7" />
									<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
								</svg>
							</div>
							<div class="play-overlay">
								<svg width="48" height="48" viewBox="0 0 24 24" fill="white">
									<polygon points="5 3 19 12 5 21 5 3" />
								</svg>
							</div>
						</button>
						<div class="video-info">
							<span class="video-name" title={video.name}>{video.name}</span>
							<span class="video-meta">{formatSize(video.size)}</span>
						</div>
						<button class="select-checkbox" class:checked={selectedVideos.has(video.id)} on:click={(e) => toggleSelect(video, e)}>
							{#if selectedVideos.has(video.id)}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<div class="video-list">
				{#each videos as video}
					<div class="video-item" class:selected={selectedVideos.has(video.id)}>
						<button class="select-checkbox" class:checked={selectedVideos.has(video.id)} on:click={(e) => toggleSelect(video, e)}>
							{#if selectedVideos.has(video.id)}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</button>
						<button class="video-icon" on:click={() => openPlayer(video)}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polygon points="23 7 16 12 23 17 23 7" />
								<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
							</svg>
						</button>
						<div class="video-info-row">
							<span class="video-name">{video.name}</span>
							<span class="video-meta">{formatDate(video.updatedAt)} • {formatSize(video.size)}</span>
						</div>
						<a href={getVideoUrl(video)} download={video.name} class="btn-icon" title="Descargar">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="7 10 12 15 17 10" />
								<line x1="12" y1="15" x2="12" y2="3" />
							</svg>
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Video Player Modal -->
{#if showPlayer && selectedVideo}
	<div class="player-modal" on:click={closePlayer}>
		<div class="player-header" on:click|stopPropagation>
			<div class="player-info">
				<span class="player-name">{selectedVideo.name}</span>
				<span class="player-meta">{formatDate(selectedVideo.createdAt)} • {formatSize(selectedVideo.size)}</span>
			</div>
			<div class="player-actions">
				<a href={getVideoUrl(selectedVideo)} download={selectedVideo.name} class="btn-icon" title="Descargar">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
				</a>
				<button class="btn-icon" on:click={closePlayer} title="Cerrar">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		</div>

		<div class="player-content" on:click|stopPropagation>
			<video controls autoplay src={getVideoUrl(selectedVideo)}>
				<track kind="captions" />
				Tu navegador no soporta la reproducción de video.
			</video>
		</div>
	</div>
{/if}

<style>
	.videos-page {
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

	/* Grid View */
	.video-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}

	.video-card {
		position: relative;
		background: var(--bg-card);
		border-radius: 12px;
		overflow: hidden;
		transition: transform 0.2s;
	}

	.video-card:hover {
		transform: translateY(-2px);
	}

	.video-card.selected {
		outline: 3px solid var(--primary);
	}

	.video-wrapper {
		width: 100%;
		aspect-ratio: 16/9;
		border: none;
		padding: 0;
		cursor: pointer;
		background: #1a1a2e;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.video-thumbnail {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #4a4a6a;
	}

	.play-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.3);
		opacity: 0;
		transition: opacity 0.2s;
	}

	.video-wrapper:hover .play-overlay {
		opacity: 1;
	}

	.video-info {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.video-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.video-meta {
		font-size: 13px;
		color: var(--text-muted);
	}

	.video-card .select-checkbox {
		position: absolute;
		top: 8px;
		left: 8px;
		opacity: 0;
		transition: opacity 0.2s;
		z-index: 1;
	}

	.video-card:hover .select-checkbox,
	.select-checkbox.checked {
		opacity: 1;
	}

	/* List View */
	.video-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.video-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-card);
		border-radius: 8px;
		transition: background 0.2s;
	}

	.video-item:hover {
		background: var(--bg-hover);
	}

	.video-item.selected {
		background: var(--primary-light);
	}

	.video-icon {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a1a2e;
		color: #7c7ca0;
		border: none;
		cursor: pointer;
	}

	.video-info-row {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.select-checkbox {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		border: 2px solid white;
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

	/* Player Modal */
	.player-modal {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.95);
		z-index: 100;
		display: flex;
		flex-direction: column;
	}

	.player-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		background: rgba(0, 0, 0, 0.5);
	}

	.player-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.player-name {
		font-size: 16px;
		font-weight: 500;
		color: white;
	}

	.player-meta {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.6);
	}

	.player-actions {
		display: flex;
		gap: 8px;
	}

	.player-actions .btn-icon {
		color: white;
	}

	.player-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.player-content video {
		max-width: 100%;
		max-height: 100%;
		border-radius: 8px;
	}

	@media (max-width: 768px) {
		.video-grid {
			grid-template-columns: 1fr;
			gap: 8px;
		}

		.video-card .select-checkbox {
			opacity: 1;
		}
	}
</style>
