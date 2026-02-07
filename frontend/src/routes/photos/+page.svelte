<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface Photo {
		id: string;
		name: string;
		path: string;
		size: number;
		mimeType: string;
		createdAt: string;
		updatedAt: string;
	}

	let photos: Photo[] = [];
	let isLoading = true;
	let viewMode: 'grid' | 'timeline' = 'grid';
	let selectedPhotos: Set<string> = new Set();
	let selectedPhoto: Photo | null = null;
	let showLightbox = false;
	let currentIndex = 0;

	let initialLoadDone = false;

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	// Reactive load: wait for auth to be ready
	$: if (!$auth.isLoading && $auth.isAuthenticated && !initialLoadDone) {
		initialLoadDone = true;
		loadPhotos();
	}

	$: groupedPhotos = groupByMonth(photos);

	function groupByMonth(list: Photo[]): Record<string, Photo[]> {
		const groups: Record<string, Photo[]> = {};
		for (const photo of list) {
			const date = new Date(photo.createdAt);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
			if (!groups[label]) {
				groups[label] = [];
			}
			groups[label].push(photo);
		}
		return groups;
	}

	async function loadPhotos() {
		isLoading = true;
		const token = api.getToken();

		try {
			const res = await fetch('/api/v1/files?perPage=1000', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (res.ok) {
				const response = await res.json();
				// API returns paginated response with items array
				const allFiles = response.items || response || [];
				photos = allFiles.filter((f: Photo) =>
					f.mimeType && f.mimeType.startsWith('image/')
				).sort((a: Photo, b: Photo) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			}
		} catch (e) {
			console.error('Error loading photos:', e);
		}

		isLoading = false;
	}

	function getPhotoUrl(photo: Photo): string {
		const token = api.getToken();
		if (!token) {
			console.warn('No token available for photo URL');
			return '';
		}
		return `/api/v1/files/${photo.id}/download?token=${encodeURIComponent(token)}`;
	}

	function getThumbnailUrl(photo: Photo): string {
		return getPhotoUrl(photo);
	}

	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		img.style.display = 'none';
		const wrapper = img.parentElement;
		if (wrapper && !wrapper.querySelector('.fallback-icon')) {
			const fallback = document.createElement('div');
			fallback.className = 'fallback-icon';
			fallback.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
			wrapper.appendChild(fallback);
		}
	}

	function toggleSelect(photo: Photo, event: MouseEvent) {
		event.stopPropagation();
		if (selectedPhotos.has(photo.id)) {
			selectedPhotos.delete(photo.id);
		} else {
			selectedPhotos.add(photo.id);
		}
		selectedPhotos = selectedPhotos;
	}

	function selectAll() {
		if (selectedPhotos.size === photos.length) {
			selectedPhotos.clear();
		} else {
			photos.forEach((p) => selectedPhotos.add(p.id));
		}
		selectedPhotos = selectedPhotos;
	}

	function openLightbox(photo: Photo) {
		selectedPhoto = photo;
		currentIndex = photos.findIndex((p) => p.id === photo.id);
		showLightbox = true;
	}

	function closeLightbox() {
		showLightbox = false;
		selectedPhoto = null;
	}

	function previousPhoto() {
		if (currentIndex > 0) {
			currentIndex--;
			selectedPhoto = photos[currentIndex];
		}
	}

	function nextPhoto() {
		if (currentIndex < photos.length - 1) {
			currentIndex++;
			selectedPhoto = photos[currentIndex];
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showLightbox) return;
		if (event.key === 'Escape') closeLightbox();
		if (event.key === 'ArrowLeft') previousPhoto();
		if (event.key === 'ArrowRight') nextPhoto();
	}

	async function downloadSelected() {
		const token = api.getToken();
		for (const id of selectedPhotos) {
			const photo = photos.find((p) => p.id === id);
			if (photo) {
				const a = document.createElement('a');
				a.href = getPhotoUrl(photo);
				a.download = photo.name;
				a.click();
			}
		}
	}

	async function deleteSelected() {
		if (!confirm(`¿Eliminar ${selectedPhotos.size} foto(s)?`)) return;

		const token = api.getToken();
		for (const id of selectedPhotos) {
			try {
				await fetch(`/api/v1/files/${id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${token}` }
				});
			} catch (e) {
				console.error('Error deleting photo:', e);
			}
		}

		photos = photos.filter((p) => !selectedPhotos.has(p.id));
		selectedPhotos.clear();
		selectedPhotos = selectedPhotos;
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
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="photos-page">
	<!-- Header -->
	<header class="photos-header">
		<div class="header-left">
			<a href="/files" class="back-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12" />
					<polyline points="12 19 5 12 12 5" />
				</svg>
			</a>
			<h1>Fotos</h1>
			<span class="photo-count">{photos.length} fotos</span>
		</div>

		<div class="header-center">
			{#if selectedPhotos.size > 0}
				<div class="selection-actions">
					<span class="selection-count">{selectedPhotos.size} seleccionadas</span>
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
					<button class="btn-icon" on:click={() => { selectedPhotos.clear(); selectedPhotos = selectedPhotos; }}>
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
					{#if selectedPhotos.size === photos.length && photos.length > 0}
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
				<button class="btn-view" class:active={viewMode === 'timeline'} on:click={() => (viewMode = 'timeline')} title="Línea de tiempo">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="12" y1="20" x2="12" y2="10" />
						<line x1="18" y1="20" x2="18" y2="4" />
						<line x1="6" y1="20" x2="6" y2="16" />
					</svg>
				</button>
			</div>
		</div>
	</header>

	<!-- Content -->
	<main class="photos-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Cargando fotos...</p>
			</div>
		{:else if photos.length === 0}
			<div class="empty-state">
				<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
					<circle cx="8.5" cy="8.5" r="1.5" />
					<polyline points="21 15 16 10 5 21" />
				</svg>
				<h2>No hay fotos</h2>
				<p>Las imágenes que subas aparecerán aquí</p>
				<a href="/files" class="btn btn-primary">Ir a Archivos</a>
			</div>
		{:else if viewMode === 'grid'}
			<div class="photo-grid">
				{#each photos as photo}
					<div class="photo-item" class:selected={selectedPhotos.has(photo.id)}>
						<button class="photo-wrapper" on:click={() => openLightbox(photo)}>
							{#if getThumbnailUrl(photo)}
								<img src={getThumbnailUrl(photo)} alt={photo.name} loading="lazy" on:error={handleImageError} />
							{:else}
								<div class="fallback-icon">
									<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
								</div>
							{/if}
						</button>
						<button class="select-checkbox" class:checked={selectedPhotos.has(photo.id)} on:click={(e) => toggleSelect(photo, e)}>
							{#if selectedPhotos.has(photo.id)}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<div class="photo-timeline">
				{#each Object.entries(groupedPhotos) as [month, monthPhotos]}
					<div class="timeline-group">
						<h3 class="timeline-month">{month}</h3>
						<div class="timeline-grid">
							{#each monthPhotos as photo}
								<div class="photo-item" class:selected={selectedPhotos.has(photo.id)}>
									<button class="photo-wrapper" on:click={() => openLightbox(photo)}>
										{#if getThumbnailUrl(photo)}
											<img src={getThumbnailUrl(photo)} alt={photo.name} loading="lazy" on:error={handleImageError} />
										{:else}
											<div class="fallback-icon">
												<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
											</div>
										{/if}
									</button>
									<button class="select-checkbox" class:checked={selectedPhotos.has(photo.id)} on:click={(e) => toggleSelect(photo, e)}>
										{#if selectedPhotos.has(photo.id)}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
												<polyline points="20 6 9 17 4 12" />
											</svg>
										{/if}
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Lightbox -->
{#if showLightbox && selectedPhoto}
	<div class="lightbox" on:click={closeLightbox}>
		<div class="lightbox-header" on:click|stopPropagation>
			<div class="lightbox-info">
				<span class="lightbox-name">{selectedPhoto.name}</span>
				<span class="lightbox-meta">{formatDate(selectedPhoto.createdAt)} • {formatSize(selectedPhoto.size)}</span>
			</div>
			<div class="lightbox-actions">
				<a href={getPhotoUrl(selectedPhoto)} download={selectedPhoto.name} class="btn-icon" title="Descargar">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
				</a>
				<button class="btn-icon" on:click={closeLightbox} title="Cerrar">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		</div>

		<div class="lightbox-content" on:click|stopPropagation>
			{#if currentIndex > 0}
				<button class="nav-btn prev" on:click|stopPropagation={previousPhoto}>
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
			{/if}

			<img src={getPhotoUrl(selectedPhoto)} alt={selectedPhoto.name} />

			{#if currentIndex < photos.length - 1}
				<button class="nav-btn next" on:click|stopPropagation={nextPhoto}>
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>
			{/if}
		</div>

		<div class="lightbox-counter">
			{currentIndex + 1} / {photos.length}
		</div>
	</div>
{/if}

<style>
	.photos-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg);
	}

	.photos-header {
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

	.photo-count {
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

	.photos-content {
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

	.photo-grid,
	.timeline-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 8px;
	}

	.photo-item {
		position: relative;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg-secondary);
	}

	.photo-item.selected {
		outline: 3px solid var(--primary);
		outline-offset: -3px;
	}

	.photo-wrapper {
		width: 100%;
		height: 100%;
		border: none;
		padding: 0;
		cursor: pointer;
		background: none;
	}

	.photo-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.2s;
	}

	.photo-item:hover .photo-wrapper img {
		transform: scale(1.05);
	}

	.fallback-icon {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		color: var(--text-muted);
	}

	.select-checkbox {
		position: absolute;
		top: 8px;
		left: 8px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		border: 2px solid white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.photo-item:hover .select-checkbox,
	.select-checkbox.checked {
		opacity: 1;
	}

	.select-checkbox.checked {
		background: var(--primary);
		border-color: var(--primary);
	}

	.select-checkbox svg {
		color: white;
	}

	.photo-timeline {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.timeline-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.timeline-month {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		text-transform: capitalize;
		position: sticky;
		top: 0;
		background: var(--bg);
		padding: 8px 0;
		z-index: 1;
	}

	/* Lightbox */
	.lightbox {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.95);
		z-index: 100;
		display: flex;
		flex-direction: column;
	}

	.lightbox-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		background: rgba(0, 0, 0, 0.5);
	}

	.lightbox-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.lightbox-name {
		font-size: 16px;
		font-weight: 500;
		color: white;
	}

	.lightbox-meta {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.6);
	}

	.lightbox-actions {
		display: flex;
		gap: 8px;
	}

	.lightbox-actions .btn-icon {
		color: white;
	}

	.lightbox-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		padding: 24px;
	}

	.lightbox-content img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.nav-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.nav-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.nav-btn.prev {
		left: 24px;
	}

	.nav-btn.next {
		right: 24px;
	}

	.lightbox-counter {
		position: absolute;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		padding: 8px 16px;
		background: rgba(0, 0, 0, 0.5);
		border-radius: 20px;
		color: white;
		font-size: 14px;
	}

	@media (max-width: 768px) {
		.photo-grid,
		.timeline-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 4px;
		}

		.photo-item {
			border-radius: 0;
		}

		.select-checkbox {
			opacity: 1;
		}
	}
</style>
