<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface Document {
		id: string;
		name: string;
		path: string;
		size: number;
		mimeType: string;
		createdAt: string;
		updatedAt: string;
	}

	let documents: Document[] = [];
	let isLoading = true;
	let viewMode: 'grid' | 'list' = 'list';
	let selectedDocs: Set<string> = new Set();
	let initialLoadDone = false;

	const documentMimeTypes = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'text/plain',
		'text/csv',
		'application/rtf'
	];

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	$: if (!$auth.isLoading && $auth.isAuthenticated && !initialLoadDone) {
		initialLoadDone = true;
		loadDocuments();
	}

	async function loadDocuments() {
		isLoading = true;
		const token = api.getToken();

		try {
			const res = await fetch('/api/v1/files?perPage=1000', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (res.ok) {
				const response = await res.json();
				const allFiles = response.items || response || [];
				documents = allFiles.filter((f: Document) =>
					f.mimeType && documentMimeTypes.some(m => f.mimeType.includes(m.split('/')[1]) || f.mimeType === m)
				).sort((a: Document, b: Document) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				);
			}
		} catch (e) {
			console.error('Error loading documents:', e);
		}

		isLoading = false;
	}

	function getDownloadUrl(doc: Document): string {
		const token = api.getToken();
		return `/api/v1/files/${doc.id}/download?token=${token}`;
	}

	function toggleSelect(doc: Document, event: MouseEvent) {
		event.stopPropagation();
		if (selectedDocs.has(doc.id)) {
			selectedDocs.delete(doc.id);
		} else {
			selectedDocs.add(doc.id);
		}
		selectedDocs = selectedDocs;
	}

	function selectAll() {
		if (selectedDocs.size === documents.length) {
			selectedDocs.clear();
		} else {
			documents.forEach((d) => selectedDocs.add(d.id));
		}
		selectedDocs = selectedDocs;
	}

	async function downloadSelected() {
		for (const id of selectedDocs) {
			const doc = documents.find((d) => d.id === id);
			if (doc) {
				const a = document.createElement('a');
				a.href = getDownloadUrl(doc);
				a.download = doc.name;
				a.click();
			}
		}
	}

	async function deleteSelected() {
		if (!confirm(`¿Eliminar ${selectedDocs.size} documento(s)?`)) return;

		const token = api.getToken();
		for (const id of selectedDocs) {
			try {
				await fetch(`/api/v1/files/${id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${token}` }
				});
			} catch (e) {
				console.error('Error deleting document:', e);
			}
		}

		documents = documents.filter((d) => !selectedDocs.has(d.id));
		selectedDocs.clear();
		selectedDocs = selectedDocs;
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

	function getDocIcon(mimeType: string): string {
		if (mimeType.includes('pdf')) return 'pdf';
		if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
		if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'excel';
		if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
		if (mimeType.includes('text') || mimeType.includes('plain')) return 'text';
		return 'doc';
	}
</script>

<div class="documents-page">
	<header class="page-header">
		<div class="header-left">
			<a href="/files" class="back-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12" />
					<polyline points="12 19 5 12 12 5" />
				</svg>
			</a>
			<h1>Documentos</h1>
			<span class="item-count">{documents.length} documentos</span>
		</div>

		<div class="header-center">
			{#if selectedDocs.size > 0}
				<div class="selection-actions">
					<span class="selection-count">{selectedDocs.size} seleccionados</span>
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
					<button class="btn-icon" on:click={() => { selectedDocs.clear(); selectedDocs = selectedDocs; }}>
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
					{#if selectedDocs.size === documents.length && documents.length > 0}
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
				<p>Cargando documentos...</p>
			</div>
		{:else if documents.length === 0}
			<div class="empty-state">
				<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="16" y1="13" x2="8" y2="13" />
					<line x1="16" y1="17" x2="8" y2="17" />
					<polyline points="10 9 9 9 8 9" />
				</svg>
				<h2>No hay documentos</h2>
				<p>Los documentos que subas aparecerán aquí</p>
				<a href="/files" class="btn btn-primary">Ir a Archivos</a>
			</div>
		{:else if viewMode === 'list'}
			<div class="doc-list">
				{#each documents as doc}
					<div class="doc-item" class:selected={selectedDocs.has(doc.id)}>
						<button class="select-checkbox" class:checked={selectedDocs.has(doc.id)} on:click={(e) => toggleSelect(doc, e)}>
							{#if selectedDocs.has(doc.id)}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</button>
						<div class="doc-icon {getDocIcon(doc.mimeType)}">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
						</div>
						<div class="doc-info">
							<span class="doc-name">{doc.name}</span>
							<span class="doc-meta">{formatDate(doc.updatedAt)} • {formatSize(doc.size)}</span>
						</div>
						<a href={getDownloadUrl(doc)} download={doc.name} class="btn-icon" title="Descargar">
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
			<div class="doc-grid">
				{#each documents as doc}
					<div class="doc-card" class:selected={selectedDocs.has(doc.id)}>
						<button class="select-checkbox" class:checked={selectedDocs.has(doc.id)} on:click={(e) => toggleSelect(doc, e)}>
							{#if selectedDocs.has(doc.id)}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</button>
						<div class="doc-icon-large {getDocIcon(doc.mimeType)}">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
						</div>
						<div class="doc-card-info">
							<span class="doc-name" title={doc.name}>{doc.name}</span>
							<span class="doc-meta">{formatSize(doc.size)}</span>
						</div>
						<a href={getDownloadUrl(doc)} download={doc.name} class="download-overlay" title="Descargar">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

<style>
	.documents-page {
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

	/* List View */
	.doc-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.doc-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-card);
		border-radius: 8px;
		transition: background 0.2s;
	}

	.doc-item:hover {
		background: var(--bg-hover);
	}

	.doc-item.selected {
		background: var(--primary-light);
	}

	.doc-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
	}

	.doc-icon.pdf { background: #fee2e2; color: #dc2626; }
	.doc-icon.word { background: #dbeafe; color: #2563eb; }
	.doc-icon.excel { background: #d1fae5; color: #059669; }
	.doc-icon.ppt { background: #fef3c7; color: #d97706; }
	.doc-icon.text { background: #f3f4f6; color: #6b7280; }

	.doc-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.doc-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.doc-meta {
		font-size: 13px;
		color: var(--text-muted);
	}

	/* Grid View */
	.doc-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 16px;
	}

	.doc-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 24px 16px 16px;
		background: var(--bg-card);
		border-radius: 12px;
		transition: background 0.2s, transform 0.2s;
	}

	.doc-card:hover {
		background: var(--bg-hover);
		transform: translateY(-2px);
	}

	.doc-card.selected {
		background: var(--primary-light);
	}

	.doc-icon-large {
		width: 80px;
		height: 80px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
	}

	.doc-icon-large.pdf { background: #fee2e2; color: #dc2626; }
	.doc-icon-large.word { background: #dbeafe; color: #2563eb; }
	.doc-icon-large.excel { background: #d1fae5; color: #059669; }
	.doc-icon-large.ppt { background: #fef3c7; color: #d97706; }
	.doc-icon-large.text { background: #f3f4f6; color: #6b7280; }

	.doc-card-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 100%;
	}

	.doc-card-info .doc-name {
		text-align: center;
		max-width: 100%;
	}

	.download-overlay {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
		color: var(--text);
	}

	.doc-card:hover .download-overlay {
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

	.doc-card .select-checkbox {
		position: absolute;
		top: 8px;
		left: 8px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.doc-card:hover .select-checkbox,
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

	@media (max-width: 768px) {
		.doc-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}

		.doc-card .select-checkbox {
			opacity: 1;
		}
	}
</style>
