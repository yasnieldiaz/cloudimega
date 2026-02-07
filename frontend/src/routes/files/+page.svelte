<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { files } from '$lib/stores/files';
	import { theme } from '$lib/stores/theme';
	import { goto } from '$app/navigation';
	import { api, type CloudFile, type Share, type FileVersion, type Comment } from '$lib/api/client';

	// State
	let uploadInput: HTMLInputElement;
	let isUploading = false;
	let uploadProgress = 0;
	let isDragging = false;
	let selectedItems: Set<string> = new Set();
	let viewMode: 'list' | 'grid' = 'list';
	let sortBy: 'name' | 'size' | 'date' = 'name';
	let sortAsc = true;

	// Modals
	let showNewFolderModal = false;
	let newFolderName = '';
	let showShareModal = false;
	let shareFile: CloudFile | null = null;
	let shareData: Share | null = null;
	let sharePassword = '';
	let shareExpiry = '';
	let shareMaxDownloads: number | null = null;
	let shareLoading = false;
	let shareCopied = false;
	let showPreviewModal = false;
	let previewFile: CloudFile | null = null;
	let previewContent: string | null = null;
	let previewBlobUrl: string | null = null;
	let previewLoading = false;

	// Versions and Comments
	let detailPanelTab: 'share' | 'versions' | 'comments' = 'share';
	let fileVersions: FileVersion[] = [];
	let loadingVersions = false;
	let fileComments: Comment[] = [];
	let loadingComments = false;
	let newCommentText = '';
	let submittingComment = false;

	// Sidebar
	let searchInput = '';
	let searchDebounce: ReturnType<typeof setTimeout>;
	let initialLoadDone = false;

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	onMount(() => {
		theme.init();

		// Subscribe to auth changes and load files when authenticated
		const unsubscribe = auth.subscribe(state => {
			console.log('Auth changed:', state);
			if (!state.isLoading && state.isAuthenticated && !initialLoadDone) {
				console.log('Loading files now!');
				initialLoadDone = true;
				files.loadRoot();
				files.loadTags();
			}
		});

		return () => unsubscribe();
	});

	// Handle sidebar navigation
	function handleSidebarClick(view: string) {
		switch (view) {
			case 'all':
				files.loadRoot();
				break;
			case 'recent':
				files.loadRecent();
				break;
			case 'favorites':
				files.loadFavorites();
				break;
			case 'trash':
				files.loadTrash();
				break;
		}
	}

	// Search with debounce
	function handleSearchInput(e: Event) {
		const query = (e.target as HTMLInputElement).value;
		searchInput = query;
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			if (query.trim()) {
				files.search(query);
			} else {
				files.loadRoot();
			}
		}, 300);
	}

	// Drag and drop
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles && droppedFiles.length > 0) {
			await uploadFiles(Array.from(droppedFiles));
		}
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const fileList = input.files;

		if (!fileList || fileList.length === 0) return;
		await uploadFiles(Array.from(fileList));
		input.value = '';
	}

	async function uploadFiles(fileList: File[]) {
		isUploading = true;
		uploadProgress = 0;

		for (let i = 0; i < fileList.length; i++) {
			await files.uploadFile(fileList[i]);
			uploadProgress = ((i + 1) / fileList.length) * 100;
		}

		isUploading = false;
		uploadProgress = 0;
	}

	async function createFolder() {
		if (!newFolderName.trim()) return;
		const result = await files.createFolder(newFolderName);
		if (result.success) {
			newFolderName = '';
			showNewFolderModal = false;
		}
	}

	async function downloadFile(file: CloudFile) {
		const response = await api.downloadFile(file.id);
		if (response.ok) {
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = file.name;
			a.click();
			URL.revokeObjectURL(url);
		}
	}

	async function openShareModal(file: CloudFile) {
		console.log('openShareModal called with file:', file);
		shareFile = file;
		shareData = null;
		sharePassword = '';
		shareExpiry = '';
		shareMaxDownloads = null;
		shareLoading = true;
		showShareModal = true;
		detailPanelTab = 'share';
		fileVersions = [];
		fileComments = [];
		console.log('Modal state:', { showShareModal, shareFile: shareFile?.name });

		// Check if already shared
		const { data } = await api.getSharesForFile(file.id);
		if (data && data.length > 0) {
			shareData = data[0];
			if (shareData.expiresAt) {
				shareExpiry = shareData.expiresAt.split('T')[0];
			}
			if (shareData.maxDownloads) {
				shareMaxDownloads = shareData.maxDownloads;
			}
		}
		shareLoading = false;

		// Pre-load versions and comments
		loadVersions(file.id);
		loadComments(file.id);
	}

	async function createOrUpdateShare() {
		if (!shareFile) return;
		shareLoading = true;

		if (shareData) {
			// Update existing share
			const { data } = await api.updateShare(shareData.id, {
				password: sharePassword || undefined,
				expiresAt: shareExpiry ? new Date(shareExpiry).toISOString() : undefined,
				maxDownloads: shareMaxDownloads || undefined
			});
			if (data) shareData = data;
		} else {
			// Create new share
			const { data } = await api.createShare(shareFile.id, undefined, {
				password: sharePassword || undefined,
				expiresAt: shareExpiry ? new Date(shareExpiry).toISOString() : undefined,
				maxDownloads: shareMaxDownloads || undefined
			});
			if (data) shareData = data;
		}
		shareLoading = false;
	}

	async function deleteShare() {
		if (!shareData) return;
		shareLoading = true;
		await api.deleteShare(shareData.id);
		shareData = null;
		shareLoading = false;
	}

	function copyShareLink() {
		if (!shareData) return;
		const url = `${window.location.origin}/s/${shareData.token}`;
		navigator.clipboard.writeText(url);
		shareCopied = true;
		setTimeout(() => (shareCopied = false), 2000);
	}

	// Versions
	async function loadVersions(fileId: string) {
		loadingVersions = true;
		const { data } = await api.getFileVersions(fileId);
		fileVersions = data || [];
		loadingVersions = false;
	}

	async function downloadVersion(fileId: string, versionId: string, versionNumber: number) {
		const response = await api.downloadVersion(fileId, versionId);
		if (response.ok) {
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${shareFile?.name || 'file'}.v${versionNumber}`;
			a.click();
			URL.revokeObjectURL(url);
		}
	}

	async function restoreVersion(fileId: string, versionId: string) {
		const { data, error } = await api.restoreVersion(fileId, versionId);
		if (data) {
			alert('Version restaurada correctamente');
			await loadVersions(fileId);
		} else {
			alert(error || 'Error al restaurar version');
		}
	}

	// Comments
	async function loadComments(fileId: string) {
		loadingComments = true;
		const { data } = await api.getComments(fileId);
		fileComments = data || [];
		loadingComments = false;
	}

	async function addComment() {
		if (!shareFile || !newCommentText.trim()) return;
		submittingComment = true;
		const { data, error } = await api.addComment(shareFile.id, newCommentText);
		if (data) {
			fileComments = [...fileComments, data];
			newCommentText = '';
		} else {
			alert(error || 'Error al agregar comentario');
		}
		submittingComment = false;
	}

	async function resolveComment(commentId: string) {
		if (!shareFile) return;
		const { data } = await api.resolveComment(shareFile.id, commentId);
		if (data) {
			fileComments = fileComments.map(c => c.id === commentId ? data : c);
		}
	}

	async function deleteComment(commentId: string) {
		if (!shareFile) return;
		const { error } = await api.deleteComment(shareFile.id, commentId);
		if (!error) {
			fileComments = fileComments.filter(c => c.id !== commentId);
		}
	}

	function formatVersionDate(dateStr: string): string {
		return new Date(dateStr).toLocaleString('es-ES', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function openPreview(file: CloudFile) {
		previewFile = file;
		previewContent = null;
		previewBlobUrl = null;
		previewLoading = true;
		showPreviewModal = true;

		try {
			// For text/code files, load content as text
			if (file.mimeType.startsWith('text/') ||
				file.mimeType.includes('json') ||
				file.mimeType.includes('javascript') ||
				file.mimeType.includes('xml')) {
				const response = await api.getFilePreview(file.id);
				if (response.ok) {
					previewContent = await response.text();
				}
			} else if (file.mimeType.startsWith('image/') ||
					   file.mimeType.includes('pdf') ||
					   file.mimeType.startsWith('video/') ||
					   file.mimeType.startsWith('audio/')) {
				// For media files, use streaming/preview endpoint
				const response = await api.getFilePreview(file.id);
				if (response.ok) {
					const blob = await response.blob();
					previewBlobUrl = URL.createObjectURL(blob);
				} else {
					// Fallback to download if preview fails
					const downloadResponse = await api.downloadFile(file.id);
					if (downloadResponse.ok) {
						const blob = await downloadResponse.blob();
						previewBlobUrl = URL.createObjectURL(blob);
					}
				}
			}
		} catch (e) {
			console.error('Error loading preview:', e);
		}
		previewLoading = false;
	}

	function closePreview() {
		showPreviewModal = false;
		if (previewBlobUrl) {
			URL.revokeObjectURL(previewBlobUrl);
			previewBlobUrl = null;
		}
		previewFile = null;
		previewContent = null;
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Hoy';
		if (days === 1) return 'Ayer';
		if (days < 7) return `hace ${days} días`;
		return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function getFileIcon(mimeType: string, name: string): string {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType.includes('pdf')) return 'pdf';
		if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z')) return 'archive';
		if (mimeType.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'word';
		if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || name.endsWith('.xls') || name.endsWith('.xlsx')) return 'excel';
		if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || name.endsWith('.ppt') || name.endsWith('.pptx')) return 'powerpoint';
		if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('xml')) return 'text';
		return 'file';
	}

	function toggleSelect(id: string) {
		if (selectedItems.has(id)) {
			selectedItems.delete(id);
		} else {
			selectedItems.add(id);
		}
		selectedItems = selectedItems;
	}

	function selectAll() {
		if (selectedItems.size === $files.files.length + $files.folders.length) {
			selectedItems.clear();
		} else {
			$files.folders.forEach(f => selectedItems.add(f.id));
			$files.files.forEach(f => selectedItems.add(f.id));
		}
		selectedItems = selectedItems;
	}

	async function handleLogout() {
		await auth.logout();
		goto('/auth/login');
	}

	// Sort files
	$: sortedFiles = [...$files.files].sort((a, b) => {
		let cmp = 0;
		if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
		else if (sortBy === 'size') cmp = a.size - b.size;
		else if (sortBy === 'date') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
		return sortAsc ? cmp : -cmp;
	});

	$: sortedFolders = [...$files.folders].sort((a, b) => {
		return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
	});

	$: storagePercent = $auth.user ? ($auth.user.storageUsed / $auth.user.storageQuota) * 100 : 0;
</script>

<div class="app-layout">
	<!-- Sidebar -->
	<aside class="sidebar">
		<div class="sidebar-header">
			<a href="/dashboard" class="logo">
				<img src="/logo.png" alt="CloudImega" width="32" height="32" />
				CloudImega
			</a>
		</div>

		<div class="sidebar-search">
			<input
				type="text"
				placeholder="Buscar archivos..."
				class="input search-input"
				bind:value={searchInput}
				on:input={handleSearchInput}
			/>
		</div>

		<nav class="sidebar-nav">
			<a href="/dashboard" class="nav-item dashboard-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="7" height="7"/>
					<rect x="14" y="3" width="7" height="7"/>
					<rect x="14" y="14" width="7" height="7"/>
					<rect x="3" y="14" width="7" height="7"/>
				</svg>
				Dashboard
			</a>

			<div class="nav-divider"></div>

			<button
				class="nav-item"
				class:active={$files.viewMode === 'all'}
				on:click={() => handleSidebarClick('all')}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
				</svg>
				Todos los archivos
			</button>

			<button
				class="nav-item"
				class:active={$files.viewMode === 'recent'}
				on:click={() => handleSidebarClick('recent')}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<polyline points="12 6 12 12 16 14"/>
				</svg>
				Reciente
			</button>

			<button
				class="nav-item"
				class:active={$files.viewMode === 'favorites'}
				on:click={() => handleSidebarClick('favorites')}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
				</svg>
				Favoritos
			</button>

			<button
				class="nav-item"
				class:active={$files.viewMode === 'shared'}
				on:click={() => handleSidebarClick('shared')}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="18" cy="5" r="3"/>
					<circle cx="6" cy="12" r="3"/>
					<circle cx="18" cy="19" r="3"/>
					<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
					<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
				</svg>
				Compartidos
			</button>

			<button
				class="nav-item"
				class:active={$files.viewMode === 'trash'}
				on:click={() => handleSidebarClick('trash')}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="3 6 5 6 21 6"/>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
				</svg>
				Papelera
			</button>

			<!-- Tags Section -->
			{#if $files.tags.length > 0}
				<div class="nav-divider"></div>
				<span class="nav-label">Etiquetas</span>
				{#each $files.tags as tag}
					<button
						class="nav-item tag-item"
						class:active={$files.viewMode === 'tag' && $files.currentTag?.id === tag.id}
						on:click={() => files.loadFilesByTag(tag)}
					>
						<span class="tag-color" style="background-color: {tag.color}"></span>
						{tag.name}
						{#if tag.fileCount}<span class="tag-count">{tag.fileCount}</span>{/if}
					</button>
				{/each}
			{/if}

				<div class="nav-divider"></div>
			<span class="nav-label">Aplicaciones</span>

			<a href="/photos" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
					<circle cx="8.5" cy="8.5" r="1.5"/>
					<polyline points="21 15 16 10 5 21"/>
				</svg>
				Fotos
			</a>

			<a href="/documents" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
					<polyline points="14 2 14 8 20 8"/>
					<line x1="16" y1="13" x2="8" y2="13"/>
					<line x1="16" y1="17" x2="8" y2="17"/>
				</svg>
				Documentos
			</a>

			<a href="/videos" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polygon points="23 7 16 12 23 17 23 7"/>
					<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
				</svg>
				Videos
			</a>

			<a href="/audio" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18V5l12-2v13"/>
					<circle cx="6" cy="18" r="3"/>
					<circle cx="18" cy="16" r="3"/>
				</svg>
				Audio
			</a>

			<a href="/notes" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
					<polyline points="14 2 14 8 20 8"/>
					<line x1="16" y1="13" x2="8" y2="13"/>
					<line x1="16" y1="17" x2="8" y2="17"/>
				</svg>
				Notas
			</a>

			<a href="/calendar" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
					<line x1="16" y1="2" x2="16" y2="6"/>
					<line x1="8" y1="2" x2="8" y2="6"/>
					<line x1="3" y1="10" x2="21" y2="10"/>
				</svg>
				Calendario
			</a>

			<a href="/contacts" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
					<circle cx="12" cy="7" r="4"/>
				</svg>
				Contactos
			</a>

			<div class="nav-divider"></div>
			<a href="/settings" class="nav-item">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"/>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
				</svg>
				Configuracion
			</a>

			{#if $auth.user?.isAdmin}
				<div class="nav-divider"></div>
				<a href="/admin" class="nav-item admin">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="3"/>
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
					</svg>
					Administración
				</a>
			{/if}
		</nav>

		<div class="sidebar-footer">
			<div class="storage-info">
				<div class="storage-label">
					<span>Almacenamiento</span>
					<span>{formatSize($auth.user?.storageUsed || 0)} de {formatSize($auth.user?.storageQuota || 0)}</span>
				</div>
				<div class="progress">
					<div class="progress-bar" style="width: {storagePercent}%"></div>
				</div>
			</div>

			<div class="footer-actions">
				<button class="theme-toggle" on:click={() => theme.toggle()} title={$theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
					{#if $theme === 'dark'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="5"/>
							<line x1="12" y1="1" x2="12" y2="3"/>
							<line x1="12" y1="21" x2="12" y2="23"/>
							<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
							<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
							<line x1="1" y1="12" x2="3" y2="12"/>
							<line x1="21" y1="12" x2="23" y2="12"/>
							<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
							<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
						</svg>
					{:else}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
						</svg>
					{/if}
				</button>
			</div>

			<div class="user-menu">
				<button class="user-btn" on:click={handleLogout}>
					<div class="avatar">{$auth.user?.name?.charAt(0) || 'U'}</div>
					<span class="user-name">{$auth.user?.name}</span>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
						<polyline points="16 17 21 12 16 7"/>
						<line x1="21" y1="12" x2="9" y2="12"/>
					</svg>
				</button>
			</div>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="main-content" on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop}>
		<!-- Header -->
		<header class="content-header">
			<div class="breadcrumb">
				{#each $files.path as folder, i}
					<button
						class="breadcrumb-item"
						class:active={i === $files.path.length - 1}
						on:click={() => files.navigateTo(folder)}
					>
						{folder.isRoot ? 'Archivos' : folder.name}
					</button>
					{#if i < $files.path.length - 1}
						<span class="breadcrumb-sep">/</span>
					{/if}
				{/each}
			</div>

			<div class="header-actions">
				<button class="btn btn-primary" on:click={() => uploadInput.click()} disabled={isUploading}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
						<polyline points="17 8 12 3 7 8"/>
						<line x1="12" y1="3" x2="12" y2="15"/>
					</svg>
					{isUploading ? 'Subiendo...' : 'Subir'}
				</button>
				<input type="file" bind:this={uploadInput} on:change={handleFileUpload} multiple style="display: none" />

				<button class="btn btn-secondary" on:click={() => (showNewFolderModal = true)}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						<line x1="12" y1="11" x2="12" y2="17"/>
						<line x1="9" y1="14" x2="15" y2="14"/>
					</svg>
					Nueva carpeta
				</button>

				<div class="view-toggle">
					<button
						class="btn-icon"
						class:active={viewMode === 'list'}
						on:click={() => viewMode = 'list'}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="8" y1="6" x2="21" y2="6"/>
							<line x1="8" y1="12" x2="21" y2="12"/>
							<line x1="8" y1="18" x2="21" y2="18"/>
							<line x1="3" y1="6" x2="3.01" y2="6"/>
							<line x1="3" y1="12" x2="3.01" y2="12"/>
							<line x1="3" y1="18" x2="3.01" y2="18"/>
						</svg>
					</button>
					<button
						class="btn-icon"
						class:active={viewMode === 'grid'}
						on:click={() => viewMode = 'grid'}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="7" height="7"/>
							<rect x="14" y="3" width="7" height="7"/>
							<rect x="14" y="14" width="7" height="7"/>
							<rect x="3" y="14" width="7" height="7"/>
						</svg>
					</button>
				</div>
			</div>
		</header>

		<!-- Upload Progress -->
		{#if isUploading}
			<div class="upload-progress">
				<div class="progress">
					<div class="progress-bar" style="width: {uploadProgress}%"></div>
				</div>
				<span>Subiendo archivos... {Math.round(uploadProgress)}%</span>
			</div>
		{/if}

		<!-- Drop Zone Overlay -->
		{#if isDragging}
			<div class="drop-overlay">
				<div class="drop-zone">
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
						<polyline points="17 8 12 3 7 8"/>
						<line x1="12" y1="3" x2="12" y2="15"/>
					</svg>
					<p>Suelta los archivos aquí para subir</p>
				</div>
			</div>
		{/if}

		<!-- Content -->
		{#if $files.isLoading}
			<div class="loading-state">
				<div class="spinner spinner-lg"></div>
				<p>Cargando archivos...</p>
			</div>
		{:else if $files.error}
			<div class="error-state">
				<p>Error: {$files.error}</p>
			</div>
		{:else if viewMode === 'list'}
			<!-- List View -->
			<div class="file-table">
				<div class="table-header">
					<div class="col-checkbox">
						<input
							type="checkbox"
							class="checkbox"
							checked={selectedItems.size > 0 && selectedItems.size === $files.files.length + $files.folders.length}
							on:change={selectAll}
						/>
					</div>
					<div class="col-icon"></div>
					<button class="col-name sortable" on:click={() => { sortBy = 'name'; sortAsc = sortBy === 'name' ? !sortAsc : true; }}>
						Nombre
						{#if sortBy === 'name'}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points={sortAsc ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
							</svg>
						{/if}
					</button>
					<button class="col-size sortable" on:click={() => { sortBy = 'size'; sortAsc = sortBy === 'size' ? !sortAsc : true; }}>
						Tamaño
						{#if sortBy === 'size'}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points={sortAsc ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
							</svg>
						{/if}
					</button>
					<button class="col-date sortable" on:click={() => { sortBy = 'date'; sortAsc = sortBy === 'date' ? !sortAsc : true; }}>
						Modificado
						{#if sortBy === 'date'}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points={sortAsc ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
							</svg>
						{/if}
					</button>
					<div class="col-actions"></div>
				</div>

				<!-- Folders -->
				{#each sortedFolders as folder}
					<div
						class="table-row"
						class:selected={selectedItems.has(folder.id)}
						on:dblclick={() => files.navigateTo(folder)}
					>
						<div class="col-checkbox">
							<input
								type="checkbox"
								class="checkbox"
								checked={selectedItems.has(folder.id)}
								on:change={() => toggleSelect(folder.id)}
							/>
						</div>
						<div class="col-icon">
							<div class="file-icon-wrapper folder">
								<svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
									<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
								</svg>
							</div>
						</div>
						<div class="col-name">{folder.name}</div>
						<div class="col-size">—</div>
						<div class="col-date">{formatDate(folder.updatedAt)}</div>
						<div class="col-actions">
							<button class="btn-icon" on:click|stopPropagation={() => files.deleteFolder(folder.id)}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="3 6 5 6 21 6"/>
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
								</svg>
							</button>
						</div>
					</div>
				{/each}

				<!-- Files -->
				{#each sortedFiles as file}
					<div
						class="table-row"
						class:selected={selectedItems.has(file.id)}
						on:dblclick={() => openPreview(file)}
					>
						<div class="col-checkbox">
							<input
								type="checkbox"
								class="checkbox"
								checked={selectedItems.has(file.id)}
								on:change={() => toggleSelect(file.id)}
							/>
						</div>
						<div class="col-icon">
							<div class="file-icon-wrapper {getFileIcon(file.mimeType, file.name)}">
								{#if getFileIcon(file.mimeType, file.name) === 'image'}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
										<circle cx="8.5" cy="8.5" r="1.5"/>
										<polyline points="21 15 16 10 5 21"/>
									</svg>
								{:else if getFileIcon(file.mimeType, file.name) === 'video'}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<polygon points="23 7 16 12 23 17 23 7"/>
										<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
									</svg>
								{:else if getFileIcon(file.mimeType, file.name) === 'audio'}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<path d="M9 18V5l12-2v13"/>
										<circle cx="6" cy="18" r="3"/>
										<circle cx="18" cy="16" r="3"/>
									</svg>
								{:else if getFileIcon(file.mimeType, file.name) === 'pdf'}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
										<polyline points="14 2 14 8 20 8"/>
										<line x1="16" y1="13" x2="8" y2="13"/>
										<line x1="16" y1="17" x2="8" y2="17"/>
									</svg>
								{:else if getFileIcon(file.mimeType, file.name) === 'archive'}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<polyline points="21 8 21 21 3 21 3 8"/>
										<rect x="1" y="3" width="22" height="5"/>
										<line x1="10" y1="12" x2="14" y2="12"/>
									</svg>
								{:else if getFileIcon(file.mimeType, file.name) === 'word'}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
										<polyline points="14 2 14 8 20 8"/>
									</svg>
								{:else if getFileIcon(file.mimeType, file.name) === 'excel'}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
										<polyline points="14 2 14 8 20 8"/>
									</svg>
								{:else}
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
										<polyline points="14 2 14 8 20 8"/>
									</svg>
								{/if}
							</div>
						</div>
						<div class="col-name">
							{file.name}
							{#if false}
								<span class="badge badge-primary">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="18" cy="5" r="3"/>
										<circle cx="6" cy="12" r="3"/>
										<circle cx="18" cy="19" r="3"/>
										<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
										<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
									</svg>
									Compartido
								</span>
							{/if}
						</div>
						<div class="col-size">{formatSize(file.size)}</div>
						<div class="col-date">{formatDate(file.updatedAt)}</div>
						<div class="col-actions">
							{#if $files.viewMode === 'trash'}
								<!-- Trash actions -->
								<button class="btn-icon" on:click|stopPropagation={() => files.restoreFile(file.id)} title="Restaurar">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
										<path d="M21 3v5h-5"/>
										<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
									</svg>
								</button>
								<button class="btn-icon btn-danger" on:click|stopPropagation={() => files.permanentDeleteFile(file.id)} title="Eliminar permanentemente">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3 6 5 6 21 6"/>
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
										<line x1="10" y1="11" x2="10" y2="17"/>
										<line x1="14" y1="11" x2="14" y2="17"/>
									</svg>
								</button>
							{:else}
								<!-- Normal actions -->
								<button
									class="btn-icon"
									class:favorite={file.isFavorite}
									on:click|stopPropagation={() => files.toggleFileFavorite(file.id, file.isFavorite)}
									title={file.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill={file.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
										<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
									</svg>
								</button>
								<button class="btn-icon" on:click|stopPropagation={() => downloadFile(file)} title="Descargar">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
										<polyline points="7 10 12 15 17 10"/>
										<line x1="12" y1="15" x2="12" y2="3"/>
									</svg>
								</button>
								<button class="btn-icon" on:click|stopPropagation={() => openShareModal(file)} title="Compartir">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="18" cy="5" r="3"/>
										<circle cx="6" cy="12" r="3"/>
										<circle cx="18" cy="19" r="3"/>
										<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
										<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
									</svg>
								</button>
								<button class="btn-icon" on:click|stopPropagation={() => files.deleteFile(file.id)} title="Eliminar">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3 6 5 6 21 6"/>
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
									</svg>
								</button>
							{/if}
						</div>
					</div>
				{/each}

				{#if sortedFolders.length === 0 && sortedFiles.length === 0}
					<div class="empty-state">
						<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
							<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						</svg>
						<h3>Esta carpeta está vacía</h3>
						<p>Arrastra archivos aquí o haz clic en "Subir" para comenzar</p>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Grid View -->
			<div class="file-grid">
				{#each sortedFolders as folder}
					<div
						class="grid-item folder"
						class:selected={selectedItems.has(folder.id)}
						on:dblclick={() => files.navigateTo(folder)}
					>
						<div class="grid-icon">
							<div class="file-icon-wrapper folder">
								<svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
									<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
								</svg>
							</div>
						</div>
						<div class="grid-name">{folder.name}</div>
					</div>
				{/each}

				{#each sortedFiles as file}
					<div
						class="grid-item"
						class:selected={selectedItems.has(file.id)}
						on:dblclick={() => openPreview(file)}
					>
						<div class="grid-icon">
							{#if file.mimeType.startsWith('image/')}
								<div class="file-icon-wrapper image">
									<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
										<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
										<circle cx="8.5" cy="8.5" r="1.5"/>
										<polyline points="21 15 16 10 5 21"/>
									</svg>
								</div>
							{:else}
								<div class="file-icon-wrapper {getFileIcon(file.mimeType, file.name)}">
									{#if getFileIcon(file.mimeType, file.name) === 'video'}
										<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
											<polygon points="23 7 16 12 23 17 23 7"/>
											<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
										</svg>
									{:else if getFileIcon(file.mimeType, file.name) === 'audio'}
										<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
											<path d="M9 18V5l12-2v13"/>
											<circle cx="6" cy="18" r="3"/>
											<circle cx="18" cy="16" r="3"/>
										</svg>
									{:else if getFileIcon(file.mimeType, file.name) === 'pdf'}
										<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
											<polyline points="14 2 14 8 20 8"/>
											<line x1="16" y1="13" x2="8" y2="13"/>
											<line x1="16" y1="17" x2="8" y2="17"/>
										</svg>
									{:else}
										<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
											<polyline points="14 2 14 8 20 8"/>
										</svg>
									{/if}
								</div>
							{/if}
						</div>
						<div class="grid-name">{file.name}</div>
						<div class="grid-meta">{formatSize(file.size)}</div>
						<div class="grid-actions">
							<button class="btn-icon btn-sm" on:click|stopPropagation={() => openShareModal(file)}>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="18" cy="5" r="3"/>
									<circle cx="6" cy="12" r="3"/>
									<circle cx="18" cy="19" r="3"/>
									<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
									<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- New Folder Modal -->
{#if showNewFolderModal}
	<div class="modal-overlay" on:click={() => (showNewFolderModal = false)}>
		<div class="modal card" on:click|stopPropagation>
			<h2>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
				</svg>
				Nueva carpeta
			</h2>
			<div class="modal-body">
				<div class="input-group">
					<label for="folder-name">Nombre de la carpeta</label>
					<input
						id="folder-name"
						type="text"
						class="input"
						bind:value={newFolderName}
						placeholder="Mi carpeta"
						on:keypress={(e) => e.key === 'Enter' && createFolder()}
						autofocus
					/>
				</div>
			</div>
			<div class="modal-actions">
				<button class="btn btn-secondary" on:click={() => (showNewFolderModal = false)}>
					Cancelar
				</button>
				<button class="btn btn-primary" on:click={createFolder}>
					Crear
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Share Panel -->
{#if showShareModal && shareFile}
	<div class="modal-overlay" on:click={() => (showShareModal = false)} role="dialog" aria-modal="true">
		<div class="modal card" on:click|stopPropagation style="background: white; color: black; min-height: 300px; max-width: 500px;">
			<header class="share-panel-header" style="display: flex; justify-content: space-between; padding: 16px;">
				<h2 style="color: black;">{shareFile.name}</h2>
				<button class="btn-icon" on:click={() => (showShareModal = false)}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</header>

			<!-- Tabs -->
			<div class="share-tabs">
				<button class="share-tab" class:active={detailPanelTab === 'share'} on:click={() => detailPanelTab = 'share'}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="18" cy="5" r="3"/>
						<circle cx="6" cy="12" r="3"/>
						<circle cx="18" cy="19" r="3"/>
						<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
						<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
					</svg>
					Compartir
				</button>
				<button class="share-tab" class:active={detailPanelTab === 'versions'} on:click={() => detailPanelTab = 'versions'}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="12 8 12 12 14 14"/>
						<path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
					</svg>
					Versiones
					{#if fileVersions.length > 0}
						<span class="tab-badge">{fileVersions.length}</span>
					{/if}
				</button>
				<button class="share-tab" class:active={detailPanelTab === 'comments'} on:click={() => detailPanelTab = 'comments'}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
					Comentarios
					{#if fileComments.length > 0}
						<span class="tab-badge">{fileComments.length}</span>
					{/if}
				</button>
			</div>

			{#if shareLoading && detailPanelTab === 'share'}
				<div class="share-loading">
					<div class="spinner"></div>
				</div>
			{:else if detailPanelTab === 'versions'}
				<!-- Versions Tab -->
				<div class="share-panel-content">
					{#if loadingVersions}
						<div class="share-loading"><div class="spinner"></div></div>
					{:else if fileVersions.length === 0}
						<div class="empty-panel">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<polyline points="12 8 12 12 14 14"/>
								<path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
							</svg>
							<p>No hay versiones anteriores</p>
							<span class="text-muted">Las versiones se crean al modificar el archivo</span>
						</div>
					{:else}
						<div class="versions-list">
							{#each fileVersions as version}
								<div class="version-item">
									<div class="version-info">
										<span class="version-number">v{version.versionNumber}</span>
										<span class="version-date">{formatVersionDate(version.createdAt)}</span>
										<span class="version-size">{formatSize(version.size)}</span>
										{#if version.changeSummary}
											<span class="version-summary">{version.changeSummary}</span>
										{/if}
									</div>
									<div class="version-actions">
										<button class="btn-icon btn-sm" on:click={() => downloadVersion(shareFile.id, version.id, version.versionNumber)} title="Descargar">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
												<polyline points="7 10 12 15 17 10"/>
												<line x1="12" y1="15" x2="12" y2="3"/>
											</svg>
										</button>
										<button class="btn-icon btn-sm" on:click={() => restoreVersion(shareFile.id, version.id)} title="Restaurar">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
												<path d="M21 3v5h-5"/>
											</svg>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if detailPanelTab === 'comments'}
				<!-- Comments Tab -->
				<div class="share-panel-content">
					<div class="comment-input">
						<textarea
							class="input"
							bind:value={newCommentText}
							placeholder="Escribe un comentario..."
							rows="2"
						></textarea>
						<button class="btn btn-primary btn-sm" on:click={addComment} disabled={submittingComment || !newCommentText.trim()}>
							{submittingComment ? 'Enviando...' : 'Comentar'}
						</button>
					</div>

					{#if loadingComments}
						<div class="share-loading"><div class="spinner"></div></div>
					{:else if fileComments.length === 0}
						<div class="empty-panel">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
							</svg>
							<p>No hay comentarios</p>
							<span class="text-muted">Se el primero en comentar</span>
						</div>
					{:else}
						<div class="comments-list">
							{#each fileComments as comment}
								<div class="comment-item" class:resolved={comment.isResolved}>
									<div class="comment-header">
										<span class="comment-author">{comment.userName}</span>
										<span class="comment-date">{formatDate(comment.createdAt)}</span>
									</div>
									<div class="comment-content">{comment.content}</div>
									<div class="comment-actions">
										<button class="btn-link" on:click={() => resolveComment(comment.id)}>
											{comment.isResolved ? 'Reabrir' : 'Resolver'}
										</button>
										<button class="btn-link danger" on:click={() => deleteComment(comment.id)}>
											Eliminar
										</button>
									</div>
									{#if comment.replies && comment.replies.length > 0}
										<div class="comment-replies">
											{#each comment.replies as reply}
												<div class="reply-item">
													<span class="comment-author">{reply.userName}</span>
													<span class="comment-date">{formatDate(reply.createdAt)}</span>
													<div class="comment-content">{reply.content}</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<div class="share-panel-content">
					<!-- Internal Sharing Section -->
					<section class="share-section">
						<h3>
							Recursos compartidos internamente
							<button class="btn-icon btn-sm" title="Información">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<line x1="12" y1="16" x2="12" y2="12"/>
									<line x1="12" y1="8" x2="12.01" y2="8"/>
								</svg>
							</button>
						</h3>
						<div class="share-input-wrapper">
							<input type="text" class="input" placeholder="Compartir con cuentas y equipos" />
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="6 9 12 15 18 9"/>
							</svg>
						</div>

						<button class="share-option-btn">
							<div class="share-option-icon">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="1"/>
									<circle cx="19" cy="12" r="1"/>
									<circle cx="5" cy="12" r="1"/>
								</svg>
							</div>
							<span>Otros con acceso</span>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="6 9 12 15 18 9"/>
							</svg>
						</button>

						<div class="share-option-btn">
							<div class="share-option-icon">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
									<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
								</svg>
							</div>
							<div class="share-option-text">
								<span>Enlace interno</span>
								<small>Sólo funciona para personas con acceso</small>
							</div>
							<button class="btn-icon btn-sm" title="Copiar enlace">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
									<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
								</svg>
							</button>
						</div>
					</section>

					<!-- External Sharing Section -->
					<section class="share-section">
						<h3>
							Recursos compartidos externos
							<button class="btn-icon btn-sm" title="Información">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<line x1="12" y1="16" x2="12" y2="12"/>
									<line x1="12" y1="8" x2="12.01" y2="8"/>
								</svg>
							</button>
						</h3>
						<div class="share-input-wrapper">
							<input type="text" class="input" placeholder="Email, ID de nube federada" />
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="6 9 12 15 18 9"/>
							</svg>
						</div>

						<!-- Public Link -->
						{#if shareData}
							<div class="public-link-active">
								<div class="public-link-header">
									<div class="share-option-icon primary">
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
											<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
										</svg>
									</div>
									<div class="public-link-info">
										<span class="public-link-title">Enlace público</span>
										<div class="public-link-badges">
											{#if shareData.hasPassword}
												<span class="mini-badge">
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
														<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
													</svg>
												</span>
											{/if}
											{#if shareData.expiresAt}
												<span class="mini-badge">
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<circle cx="12" cy="12" r="10"/>
														<polyline points="12 6 12 12 16 14"/>
													</svg>
												</span>
											{/if}
										</div>
									</div>
									<button class="btn-icon btn-sm" class:copy-success={shareCopied} on:click={copyShareLink} title="Copiar enlace">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
											<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
										</svg>
									</button>
								</div>

								<!-- Link options (collapsible) -->
								<div class="public-link-options">
									<div class="link-option">
										<label>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
												<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
											</svg>
											Contraseña
										</label>
										<input
											type="password"
											class="input input-sm"
											bind:value={sharePassword}
											placeholder={shareData.hasPassword ? '••••••••' : 'Sin contraseña'}
										/>
									</div>
									<div class="link-option">
										<label>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<circle cx="12" cy="12" r="10"/>
												<polyline points="12 6 12 12 16 14"/>
											</svg>
											Caducidad
										</label>
										<input
											type="date"
											class="input input-sm"
											bind:value={shareExpiry}
											min={new Date().toISOString().split('T')[0]}
										/>
									</div>
									<div class="link-option">
										<label>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
												<polyline points="7 10 12 15 17 10"/>
												<line x1="12" y1="15" x2="12" y2="3"/>
											</svg>
											Máx. descargas
										</label>
										<input
											type="number"
											class="input input-sm"
											bind:value={shareMaxDownloads}
											placeholder="∞"
											min="1"
										/>
									</div>
									{#if shareData.downloadCount > 0}
										<div class="download-count">
											Descargado {shareData.downloadCount} {shareData.downloadCount === 1 ? 'vez' : 'veces'}
										</div>
									{/if}
									<div class="link-actions">
										<button class="btn btn-sm btn-secondary" on:click={createOrUpdateShare}>
											Guardar
										</button>
										<button class="btn btn-sm btn-danger" on:click={deleteShare}>
											Eliminar
										</button>
									</div>
								</div>
							</div>
						{:else}
							<button class="share-option-btn create-link" on:click={createOrUpdateShare}>
								<div class="share-option-icon primary">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
										<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
									</svg>
								</div>
								<span>Crear un enlace público</span>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="12" y1="5" x2="12" y2="19"/>
									<line x1="5" y1="12" x2="19" y2="12"/>
								</svg>
							</button>
						{/if}
					</section>

					<!-- Additional sharing -->
					<section class="share-section">
						<h3>
							Recursos compartidos adicionales
							<button class="btn-icon btn-sm" title="Información">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<line x1="12" y1="16" x2="12" y2="12"/>
									<line x1="12" y1="8" x2="12.01" y2="8"/>
								</svg>
							</button>
						</h3>
						<p class="share-hint">Integraciones y opciones adicionales disponibles próximamente.</p>
					</section>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Preview Modal -->
{#if showPreviewModal && previewFile}
	<div class="modal-overlay preview-overlay" on:click={closePreview}>
		<div class="preview-modal" on:click|stopPropagation>
			<header class="preview-header">
				<h3>{previewFile.name}</h3>
				<div class="preview-actions">
					<button class="btn btn-secondary" on:click={() => downloadFile(previewFile)}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
							<polyline points="7 10 12 15 17 10"/>
							<line x1="12" y1="15" x2="12" y2="3"/>
						</svg>
						Descargar
					</button>
					<button class="btn-icon" on:click={closePreview}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"/>
							<line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
					</button>
				</div>
			</header>

			<div class="preview-content">
				{#if previewLoading}
					<div class="loading-state">
						<div class="spinner spinner-lg"></div>
					</div>
				{:else if previewBlobUrl && previewFile.mimeType.startsWith('image/')}
					<img src={previewBlobUrl} alt={previewFile.name} class="preview-image" />
				{:else if previewBlobUrl && previewFile.mimeType.includes('pdf')}
					<iframe src={previewBlobUrl} class="preview-iframe" title={previewFile.name}></iframe>
				{:else if previewBlobUrl && previewFile.mimeType.startsWith('video/')}
					<div class="video-player-container">
						<video controls autoplay class="preview-video" controlsList="nodownload">
							<source src={previewBlobUrl} type={previewFile.mimeType} />
							<track kind="captions" />
							Tu navegador no soporta el elemento de video.
						</video>
					</div>
				{:else if previewBlobUrl && previewFile.mimeType.startsWith('audio/')}
					<div class="audio-player-container">
						<div class="audio-artwork">
							<svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M9 18V5l12-2v13"/>
								<circle cx="6" cy="18" r="3"/>
								<circle cx="18" cy="16" r="3"/>
							</svg>
						</div>
						<div class="audio-info">
							<h4>{previewFile.name}</h4>
							<p>{formatSize(previewFile.size)}</p>
						</div>
						<audio controls autoplay class="audio-player" controlsList="nodownload">
							<source src={previewBlobUrl} type={previewFile.mimeType} />
							Tu navegador no soporta el elemento de audio.
						</audio>
					</div>
				{:else if previewContent}
					<pre class="preview-code">{previewContent}</pre>
				{:else}
					<div class="no-preview">
						<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
							<polyline points="14 2 14 8 20 8"/>
						</svg>
						<p>Vista previa no disponible para este tipo de archivo</p>
						<button class="btn btn-primary" on:click={() => downloadFile(previewFile)}>
							Descargar archivo
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Mobile Bottom Navigation -->
<nav class="mobile-nav">
	<a href="/dashboard" class="nav-item">
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
			<polyline points="9,22 9,12 15,12 15,22"/>
		</svg>
		<span>Inicio</span>
	</a>
	<a href="/files" class="nav-item active">
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
	<button class="nav-item" on:click={() => document.querySelector('.sidebar')?.classList.toggle('mobile-open')}>
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="3" y1="12" x2="21" y2="12"/>
			<line x1="3" y1="6" x2="21" y2="6"/>
			<line x1="3" y1="18" x2="21" y2="18"/>
		</svg>
		<span>Menu</span>
	</button>
</nav>

<style>
	.app-layout {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	/* Sidebar */
	.sidebar {
		width: var(--sidebar-width);
		background: var(--bg-secondary);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	.sidebar-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 18px;
		font-weight: 600;
		color: var(--primary-light);
		text-decoration: none;
	}

	.logo:hover {
		text-decoration: none;
		opacity: 0.9;
	}

	.logo img {
		border-radius: 6px;
	}

	.sidebar-search {
		padding: 12px 16px;
	}

	.search-input {
		background: var(--bg);
		border-radius: 20px;
		padding: 8px 16px;
	}

	.sidebar-nav {
		flex: 1;
		padding: 8px;
		overflow-y: auto;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 16px;
		background: none;
		border: none;
		border-radius: 8px;
		color: var(--text-secondary);
		text-align: left;
		cursor: pointer;
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

	.nav-item.admin {
		color: var(--warning);
		text-decoration: none;
	}

	.nav-item.admin:hover {
		background: rgba(233, 166, 38, 0.1);
	}

	.nav-item.dashboard-link {
		color: var(--primary-light);
		text-decoration: none;
	}

	.nav-item.dashboard-link:hover {
		background: rgba(0, 130, 201, 0.15);
		color: var(--primary-light);
	}

	.nav-divider {
		height: 1px;
		background: var(--border);
		margin: 8px 0;
	}

	.nav-label {
		display: block;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		padding: 8px 16px;
		margin-top: 4px;
	}

	.tag-item {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.tag-color {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.tag-count {
		font-size: 11px;
		color: var(--text-muted);
		margin-left: auto;
	}

	.btn-icon.favorite {
		color: #fbbf24;
	}

	.btn-icon.btn-danger {
		color: #ef4444;
	}

	.btn-icon.btn-danger:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	/* Tab badge */
	.tab-badge {
		background: var(--primary);
		color: white;
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 10px;
		margin-left: 4px;
	}

	/* Empty panel */
	.empty-panel {
		padding: 40px 20px;
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-panel svg {
		opacity: 0.5;
		margin-bottom: 12px;
	}

	.empty-panel p {
		font-weight: 500;
		margin-bottom: 4px;
	}

	/* Versions */
	.versions-list {
		padding: 16px;
	}

	.version-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 12px;
		background: var(--bg-secondary);
		border-radius: 8px;
		margin-bottom: 8px;
	}

	.version-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.version-number {
		font-weight: 600;
		color: var(--primary);
	}

	.version-date, .version-size {
		font-size: 12px;
		color: var(--text-muted);
	}

	.version-summary {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.version-actions {
		display: flex;
		gap: 4px;
	}

	/* Comments */
	.comment-input {
		padding: 16px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.comment-input textarea {
		resize: vertical;
		min-height: 60px;
	}

	.comment-input button {
		align-self: flex-end;
	}

	.comments-list {
		padding: 16px;
	}

	.comment-item {
		padding: 12px;
		background: var(--bg-secondary);
		border-radius: 8px;
		margin-bottom: 8px;
	}

	.comment-item.resolved {
		opacity: 0.6;
	}

	.comment-header {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.comment-author {
		font-weight: 500;
	}

	.comment-date {
		font-size: 12px;
		color: var(--text-muted);
	}

	.comment-content {
		font-size: 14px;
		line-height: 1.5;
	}

	.comment-actions {
		display: flex;
		gap: 12px;
		margin-top: 8px;
	}

	.btn-link {
		background: none;
		border: none;
		color: var(--primary);
		font-size: 12px;
		cursor: pointer;
		padding: 0;
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.btn-link.danger {
		color: #ef4444;
	}

	.comment-replies {
		margin-top: 12px;
		padding-left: 16px;
		border-left: 2px solid var(--border);
	}

	.reply-item {
		padding: 8px 0;
	}

	.sidebar-footer {
		padding: 16px;
		border-top: 1px solid var(--border);
	}

	.storage-info {
		margin-bottom: 12px;
	}

	.footer-actions {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 12px;
	}

	.theme-toggle {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--bg-hover);
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}

	.theme-toggle:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.storage-label {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.user-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 12px;
		background: none;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text);
		cursor: pointer;
	}

	.user-btn:hover {
		background: var(--bg-hover);
	}

	.avatar {
		width: 32px;
		height: 32px;
		background: var(--primary);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 14px;
	}

	.user-name {
		flex: 1;
		text-align: left;
		font-size: 14px;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	.content-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg) 100%);
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.breadcrumb-item {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 14px;
	}

	.breadcrumb-item:hover {
		background: var(--bg-hover);
		color: var(--text);
	}

	.breadcrumb-item.active {
		color: var(--text);
		font-weight: 500;
	}

	.breadcrumb-sep {
		color: var(--text-muted);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.header-actions .btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border: none;
		padding: 10px 20px;
		border-radius: 10px;
		font-weight: 600;
		box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
		transition: all 0.3s ease;
	}

	.header-actions .btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
	}

	.header-actions .btn-secondary {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 10px 20px;
		border-radius: 10px;
		font-weight: 500;
		transition: all 0.3s ease;
	}

	.header-actions .btn-secondary:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.view-toggle {
		display: flex;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border-radius: 10px;
		padding: 4px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.view-toggle .btn-icon {
		border-radius: 8px;
		width: 36px;
		height: 36px;
	}

	.view-toggle .btn-icon.active {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	/* Upload Progress */
	.upload-progress {
		padding: 12px 24px;
		background: var(--bg-card);
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.upload-progress .progress {
		flex: 1;
	}

	.upload-progress span {
		font-size: 13px;
		color: var(--text-secondary);
	}

	/* Drop Overlay */
	.drop-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 130, 201, 0.1);
		border: 3px dashed var(--primary);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.drop-zone {
		text-align: center;
		color: var(--primary-light);
	}

	.drop-zone p {
		margin-top: 16px;
		font-size: 18px;
		font-weight: 500;
	}

	/* File Table */
	.file-table {
		flex: 1;
		overflow-y: auto;
		padding: 16px 24px;
	}

	.table-header {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		background: var(--bg);
		z-index: 10;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.table-row {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		margin: 4px 0;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid transparent;
	}

	.table-row:hover {
		background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
		border-color: rgba(102, 126, 234, 0.2);
		transform: translateX(4px);
	}

	.table-row.selected {
		background: linear-gradient(135deg, rgba(0, 130, 201, 0.15) 0%, rgba(0, 170, 255, 0.1) 100%);
		border-color: rgba(0, 130, 201, 0.3);
	}

	.col-checkbox {
		width: 44px;
		flex-shrink: 0;
	}

	.col-icon {
		width: 52px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.file-icon-wrapper {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s ease;
	}

	.table-row:hover .file-icon-wrapper {
		transform: scale(1.1);
	}

	.file-icon-wrapper.folder {
		background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
		box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
	}

	.file-icon-wrapper.image {
		background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
		box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);
	}

	.file-icon-wrapper.video {
		background: linear-gradient(135deg, #f472b6 0%, #ec4899 100%);
		box-shadow: 0 4px 12px rgba(244, 114, 182, 0.3);
	}

	.file-icon-wrapper.audio {
		background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
		box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
	}

	.file-icon-wrapper.pdf {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
	}

	.file-icon-wrapper.archive {
		background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
		box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
	}

	.file-icon-wrapper.word {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.file-icon-wrapper.excel {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
		box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
	}

	.file-icon-wrapper.default {
		background: linear-gradient(135deg, #64748b 0%, #475569 100%);
		box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
	}

	.col-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 12px;
		font-weight: 500;
		font-size: 14px;
	}

	.col-size {
		width: 100px;
		text-align: right;
		color: var(--text-secondary);
		flex-shrink: 0;
		font-size: 13px;
		font-weight: 500;
	}

	.col-date {
		width: 140px;
		text-align: right;
		color: var(--text-secondary);
		flex-shrink: 0;
		font-size: 13px;
	}

	.col-actions {
		width: 120px;
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.table-row:hover .col-actions {
		opacity: 1;
	}

	.col-actions .btn-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(4px);
	}

	.col-actions .btn-icon:hover {
		background: var(--primary);
		color: white;
	}

	.sortable {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sortable:hover {
		color: var(--text);
	}

	/* Grid View */
	.file-grid {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 20px;
		align-content: start;
	}

	.grid-item {
		background: linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 16px;
		padding: 20px 16px;
		text-align: center;
		cursor: pointer;
		transition: all 0.3s ease;
		position: relative;
		backdrop-filter: blur(10px);
	}

	.grid-item:hover {
		transform: translateY(-8px);
		box-shadow: 0 20px 40px rgba(0,0,0,0.3);
		border-color: rgba(102, 126, 234, 0.5);
		background: linear-gradient(145deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
	}

	.grid-item.selected {
		border-color: var(--primary);
		background: linear-gradient(145deg, rgba(0, 130, 201, 0.15) 0%, rgba(0, 170, 255, 0.1) 100%);
		box-shadow: 0 0 0 2px rgba(0, 130, 201, 0.3);
	}

	.grid-icon {
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 16px;
	}

	.grid-icon .file-icon-wrapper {
		width: 64px;
		height: 64px;
		border-radius: 16px;
		transition: transform 0.3s ease;
	}

	.grid-item:hover .grid-icon .file-icon-wrapper {
		transform: scale(1.1) rotate(5deg);
	}

	.grid-icon .thumbnail {
		max-width: 100%;
		max-height: 80px;
		border-radius: 12px;
		object-fit: cover;
		box-shadow: 0 8px 20px rgba(0,0,0,0.2);
	}

	.grid-name {
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-bottom: 4px;
	}

	.grid-meta {
		font-size: 12px;
		color: var(--text-secondary);
		margin-top: 4px;
	}

	.grid-actions {
		position: absolute;
		top: 12px;
		right: 12px;
		opacity: 0;
		transition: all 0.2s ease;
		transform: scale(0.8);
	}

	.grid-item:hover .grid-actions {
		opacity: 1;
		transform: scale(1);
	}

	.grid-actions .btn-icon {
		background: rgba(0,0,0,0.5);
		backdrop-filter: blur(10px);
		border-radius: 8px;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		color: var(--text-secondary);
		text-align: center;
	}

	.empty-state h3 {
		margin-top: 20px;
		font-size: 18px;
		color: var(--text);
	}

	.empty-state p {
		margin-top: 8px;
		font-size: 14px;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		gap: 16px;
		color: var(--text-secondary);
	}

	.loading-state.small {
		padding: 40px 20px;
	}

	/* Share Panel */
	.share-panel {
		width: 420px;
		max-height: 90vh;
		background: var(--bg-card, #ffffff);
		border-radius: 16px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		z-index: 1001;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	}

	.share-panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.share-panel-header h2 {
		font-size: 16px;
		font-weight: 600;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.share-tabs {
		display: flex;
		border-bottom: 1px solid var(--border);
	}

	.share-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 16px;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 14px;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.share-tab:hover {
		color: var(--text);
	}

	.share-tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
	}

	.share-loading {
		padding: 40px;
		display: flex;
		justify-content: center;
	}

	.share-panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px 0;
	}

	.share-section {
		padding: 0 20px 16px;
	}

	.share-section h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 12px;
	}

	.share-input-wrapper {
		position: relative;
		margin-bottom: 8px;
	}

	.share-input-wrapper .input {
		padding-right: 36px;
	}

	.share-input-wrapper > svg {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	.share-option-btn {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 12px;
		background: none;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		color: var(--text);
		transition: background 0.15s;
	}

	.share-option-btn:hover {
		background: var(--bg-hover);
	}

	.share-option-btn span {
		flex: 1;
	}

	.share-option-icon {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg-hover);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
	}

	.share-option-icon.primary {
		background: var(--primary);
		color: white;
	}

	.share-option-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.share-option-text small {
		font-size: 12px;
		color: var(--text-muted);
	}

	.share-option-btn.create-link {
		color: var(--primary);
	}

	.public-link-active {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 12px;
		margin-top: 8px;
	}

	.public-link-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.public-link-info {
		flex: 1;
	}

	.public-link-title {
		font-weight: 500;
	}

	.public-link-badges {
		display: flex;
		gap: 6px;
		margin-top: 4px;
	}

	.mini-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		background: var(--bg-hover);
		border-radius: 4px;
		color: var(--text-muted);
	}

	.public-link-options {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.link-option {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.link-option label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-secondary);
		width: 120px;
		flex-shrink: 0;
	}

	.link-option .input {
		flex: 1;
	}

	.input-sm {
		padding: 6px 10px;
		font-size: 13px;
	}

	.download-count {
		font-size: 12px;
		color: var(--text-muted);
		text-align: center;
	}

	.link-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 4px;
	}

	.share-hint {
		font-size: 13px;
		color: var(--text-muted);
	}

	.input-group label {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.text-muted {
		font-size: 12px;
		color: var(--text-muted);
	}

	/* Preview Modal */
	.preview-overlay {
		background: rgba(0, 0, 0, 0.9);
	}

	.preview-modal {
		width: 90vw;
		max-width: 1200px;
		height: 90vh;
		background: var(--bg-card);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.preview-header h3 {
		font-size: 16px;
		font-weight: 500;
	}

	.preview-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.preview-content {
		flex: 1;
		overflow: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
	}

	.preview-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.preview-iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	.preview-video {
		max-width: 100%;
		max-height: 100%;
	}

	.audio-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 30px;
		padding: 40px;
		color: var(--text-secondary);
	}

	.audio-preview audio {
		width: 400px;
		max-width: 100%;
	}

	.preview-code {
		width: 100%;
		height: 100%;
		padding: 20px;
		margin: 0;
		overflow: auto;
		background: var(--bg);
		color: var(--text);
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 13px;
		line-height: 1.6;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.no-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 40px;
		color: var(--text-secondary);
		text-align: center;
	}

	/* Mobile Bottom Navigation */
	.mobile-nav {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #ffffff;
		border-top: 1px solid var(--border);
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
		font-size: 10px;
		background: none;
		border: none;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.mobile-nav .nav-item.active {
		color: var(--primary);
	}

	.mobile-nav .nav-item:hover {
		color: var(--primary);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.app-layout {
			padding-bottom: 70px;
		}

		.mobile-nav {
			display: flex;
		}

		.sidebar {
			position: fixed;
			left: -100%;
			top: 0;
			bottom: 70px;
			width: 280px;
			z-index: 999;
			transition: left 0.3s ease;
			box-shadow: 2px 0 10px rgba(0,0,0,0.2);
		}

		.sidebar.mobile-open {
			left: 0;
		}

		.main-area {
			margin-left: 0;
		}

		.header {
			padding: 12px;
		}

		.header h1 {
			font-size: 18px;
		}

		.breadcrumb {
			font-size: 12px;
		}

		.col-size, .col-date {
			display: none;
		}

		.col-actions {
			opacity: 1;
		}

		.file-row {
			padding: 10px 12px;
		}

		.file-icon-wrapper {
			width: 36px;
			height: 36px;
		}

		.file-name {
			font-size: 13px;
		}

		.toolbar {
			padding: 8px 12px;
			gap: 8px;
			flex-wrap: wrap;
		}

		.btn {
			padding: 8px 12px;
			font-size: 13px;
		}

		.search-input {
			font-size: 14px;
		}
	}

	@media (max-width: 480px) {
		.toolbar-left {
			width: 100%;
		}

		.toolbar-right {
			width: 100%;
			justify-content: flex-end;
		}

		.view-toggle {
			display: none;
		}
	}
</style>
