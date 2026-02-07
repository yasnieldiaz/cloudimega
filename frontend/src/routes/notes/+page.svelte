<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface Note {
		id: string;
		title: string;
		content: string;
		isPinned: boolean;
		color: string | null;
		createdAt: string;
		updatedAt: string;
	}

	let notes: Note[] = [];
	let isLoading = true;
	let error = '';
	let selectedNote: Note | null = null;
	let isEditing = false;
	let isSaving = false;

	// Form
	let editTitle = '';
	let editContent = '';
	let editColor = '';

	const colors = [
		{ value: '', label: 'Sin color', bg: 'transparent' },
		{ value: '#ef4444', label: 'Rojo', bg: '#ef4444' },
		{ value: '#f97316', label: 'Naranja', bg: '#f97316' },
		{ value: '#eab308', label: 'Amarillo', bg: '#eab308' },
		{ value: '#22c55e', label: 'Verde', bg: '#22c55e' },
		{ value: '#3b82f6', label: 'Azul', bg: '#3b82f6' },
		{ value: '#8b5cf6', label: 'Violeta', bg: '#8b5cf6' },
		{ value: '#ec4899', label: 'Rosa', bg: '#ec4899' }
	];

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	onMount(async () => {
		if ($auth.isAuthenticated) {
			await loadNotes();
		}
	});

	async function loadNotes() {
		isLoading = true;
		const token = api.getToken();

		try {
			const res = await fetch('/api/v1/notes', {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			if (res.ok) {
				notes = await res.json();
			}
		} catch (e) {
			error = 'Error al cargar notas';
		}

		isLoading = false;
	}

	function newNote() {
		selectedNote = null;
		editTitle = 'Nueva nota';
		editContent = '';
		editColor = '';
		isEditing = true;
	}

	function selectNote(note: Note) {
		selectedNote = note;
		editTitle = note.title;
		editContent = note.content;
		editColor = note.color || '';
		isEditing = true;
	}

	async function saveNote() {
		if (!editTitle.trim()) return;

		isSaving = true;
		const token = api.getToken();

		try {
			if (selectedNote) {
				// Update
				const res = await fetch(`/api/v1/notes/${selectedNote.id}`, {
					method: 'PUT',
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						title: editTitle,
						content: editContent,
						color: editColor || null
					})
				});

				if (res.ok) {
					const updated = await res.json();
					notes = notes.map(n => n.id === updated.id ? updated : n);
					selectedNote = updated;
				}
			} else {
				// Create
				const res = await fetch('/api/v1/notes', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						title: editTitle,
						content: editContent,
						color: editColor || null
					})
				});

				if (res.ok) {
					const created = await res.json();
					notes = [created, ...notes];
					selectedNote = created;
				}
			}
		} catch (e) {
			console.error(e);
		}

		isSaving = false;
	}

	async function deleteNote() {
		if (!selectedNote || !confirm('¿Eliminar esta nota?')) return;

		const token = api.getToken();
		try {
			await fetch(`/api/v1/notes/${selectedNote.id}`, {
				method: 'DELETE',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			notes = notes.filter(n => n.id !== selectedNote!.id);
			selectedNote = null;
			isEditing = false;
		} catch (e) {
			console.error(e);
		}
	}

	async function togglePin(note: Note) {
		const token = api.getToken();
		try {
			const res = await fetch(`/api/v1/notes/${note.id}/pin`, {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			if (res.ok) {
				const updated = await res.json();
				notes = notes.map(n => n.id === updated.id ? updated : n);
				// Re-sort: pinned first
				notes = [...notes].sort((a, b) => {
					if (a.isPinned && !b.isPinned) return -1;
					if (!a.isPinned && b.isPinned) return 1;
					return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
				});
			}
		} catch (e) {
			console.error(e);
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('es-ES', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getPreview(content: string): string {
		return content.slice(0, 100) + (content.length > 100 ? '...' : '');
	}
</script>

<div class="notes-page">
	<!-- Sidebar -->
	<aside class="notes-sidebar">
		<div class="sidebar-header">
			<a href="/files" class="back-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12"/>
					<polyline points="12 19 5 12 12 5"/>
				</svg>
			</a>
			<h1>Notas</h1>
			<button class="btn btn-primary btn-sm" on:click={newNote}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
			</button>
		</div>

		<div class="notes-list">
			{#if isLoading}
				<div class="loading-state">
					<div class="spinner"></div>
				</div>
			{:else if notes.length === 0}
				<div class="empty-state">
					<p>No hay notas</p>
					<button class="btn btn-secondary btn-sm" on:click={newNote}>Crear nota</button>
				</div>
			{:else}
				{#each notes as note}
					<button
						class="note-item"
						class:active={selectedNote?.id === note.id}
						class:pinned={note.isPinned}
						style={note.color ? `border-left-color: ${note.color}` : ''}
						on:click={() => selectNote(note)}
					>
						<div class="note-header">
							<span class="note-title">{note.title}</span>
							{#if note.isPinned}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
									<path d="M12 2L9.19 8.63L2 9.24L7.46 14.22L5.82 21.24L12 17.77L18.18 21.24L16.54 14.22L22 9.24L14.81 8.63L12 2Z"/>
								</svg>
							{/if}
						</div>
						<p class="note-preview">{getPreview(note.content)}</p>
						<span class="note-date">{formatDate(note.updatedAt)}</span>
					</button>
				{/each}
			{/if}
		</div>
	</aside>

	<!-- Editor -->
	<main class="notes-editor">
		{#if isEditing}
			<div class="editor-header">
				<input
					type="text"
					class="title-input"
					bind:value={editTitle}
					placeholder="Título de la nota"
				/>
				<div class="editor-actions">
					{#if selectedNote}
						<button
							class="btn-icon"
							on:click={() => togglePin(selectedNote)}
							title={selectedNote.isPinned ? 'Desfijar' : 'Fijar'}
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill={selectedNote.isPinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
								<path d="M12 2L9.19 8.63L2 9.24L7.46 14.22L5.82 21.24L12 17.77L18.18 21.24L16.54 14.22L22 9.24L14.81 8.63L12 2Z"/>
							</svg>
						</button>
						<button class="btn-icon danger" on:click={deleteNote} title="Eliminar">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="3 6 5 6 21 6"/>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
							</svg>
						</button>
					{/if}
					<button class="btn btn-primary" on:click={saveNote} disabled={isSaving}>
						{isSaving ? 'Guardando...' : 'Guardar'}
					</button>
				</div>
			</div>

			<div class="color-picker">
				{#each colors as color}
					<button
						class="color-btn"
						class:active={editColor === color.value}
						style="background: {color.bg || 'var(--bg-card)'}; {color.value ? '' : 'border: 1px dashed var(--border)'}"
						on:click={() => editColor = color.value}
						title={color.label}
					></button>
				{/each}
			</div>

			<textarea
				class="content-editor"
				bind:value={editContent}
				placeholder="Escribe tu nota aquí... (soporta Markdown)"
			></textarea>
		{:else}
			<div class="no-selection">
				<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
					<polyline points="14 2 14 8 20 8"/>
					<line x1="16" y1="13" x2="8" y2="13"/>
					<line x1="16" y1="17" x2="8" y2="17"/>
				</svg>
				<p>Selecciona una nota o crea una nueva</p>
				<button class="btn btn-primary" on:click={newNote}>Nueva nota</button>
			</div>
		{/if}
	</main>
</div>

<style>
	.notes-page {
		display: flex;
		height: 100vh;
		background: var(--bg);
	}

	.notes-sidebar {
		width: 320px;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		border-bottom: 1px solid var(--border);
	}

	.sidebar-header h1 {
		flex: 1;
		font-size: 18px;
		font-weight: 600;
	}

	.back-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.back-link:hover {
		background: var(--bg-hover);
		color: var(--text);
	}

	.notes-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.note-item {
		width: 100%;
		text-align: left;
		padding: 12px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 3px solid transparent;
		border-radius: 8px;
		margin-bottom: 8px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.note-item:hover {
		border-color: var(--primary);
	}

	.note-item.active {
		background: var(--bg-hover);
		border-color: var(--primary);
	}

	.note-item.pinned {
		border-left-color: var(--warning);
	}

	.note-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.note-title {
		font-weight: 500;
		color: var(--text);
	}

	.note-header svg {
		color: var(--warning);
	}

	.note-preview {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}

	.note-date {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 8px;
		display: block;
	}

	.notes-editor {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.editor-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
	}

	.title-input {
		flex: 1;
		font-size: 20px;
		font-weight: 600;
		background: none;
		border: none;
		color: var(--text);
		outline: none;
	}

	.title-input::placeholder {
		color: var(--text-muted);
	}

	.editor-actions {
		display: flex;
		gap: 8px;
	}

	.btn-icon.danger {
		color: var(--error);
	}

	.color-picker {
		display: flex;
		gap: 8px;
		padding: 12px 24px;
		border-bottom: 1px solid var(--border);
	}

	.color-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		transition: transform 0.15s;
	}

	.color-btn:hover {
		transform: scale(1.2);
	}

	.color-btn.active {
		box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--primary);
	}

	.content-editor {
		flex: 1;
		padding: 24px;
		background: none;
		border: none;
		color: var(--text);
		font-size: 15px;
		line-height: 1.7;
		resize: none;
		outline: none;
		font-family: inherit;
	}

	.content-editor::placeholder {
		color: var(--text-muted);
	}

	.no-selection {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: var(--text-secondary);
	}

	.loading-state, .empty-state {
		padding: 40px 20px;
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: center;
	}

	@media (max-width: 768px) {
		.notes-sidebar {
			width: 100%;
			position: absolute;
			z-index: 10;
		}
	}
</style>
