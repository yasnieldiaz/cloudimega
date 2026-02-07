<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface Contact {
		id: string;
		firstName: string;
		lastName: string | null;
		email: string | null;
		phone: string | null;
		mobile: string | null;
		company: string | null;
		jobTitle: string | null;
		address: string | null;
		city: string | null;
		country: string | null;
		postalCode: string | null;
		birthday: string | null;
		notes: string | null;
		photoURL: string | null;
		isFavorite: boolean;
	}

	let contacts: Contact[] = [];
	let filteredContacts: Contact[] = [];
	let isLoading = true;
	let searchQuery = '';
	let selectedContact: Contact | null = null;
	let isEditing = false;
	let isSaving = false;
	let showDeleteConfirm = false;

	// Form fields
	let editFirstName = '';
	let editLastName = '';
	let editEmail = '';
	let editPhone = '';
	let editMobile = '';
	let editCompany = '';
	let editJobTitle = '';
	let editAddress = '';
	let editCity = '';
	let editCountry = '';
	let editPostalCode = '';
	let editBirthday = '';
	let editNotes = '';

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	$: {
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filteredContacts = contacts.filter(
				(c) =>
					c.firstName.toLowerCase().includes(query) ||
					(c.lastName && c.lastName.toLowerCase().includes(query)) ||
					(c.email && c.email.toLowerCase().includes(query)) ||
					(c.company && c.company.toLowerCase().includes(query))
			);
		} else {
			filteredContacts = contacts;
		}
	}

	$: groupedContacts = groupByLetter(filteredContacts);

	onMount(async () => {
		if ($auth.isAuthenticated) {
			await loadContacts();
		}
	});

	function groupByLetter(list: Contact[]): Record<string, Contact[]> {
		const groups: Record<string, Contact[]> = {};
		for (const contact of list) {
			const letter = contact.firstName[0].toUpperCase();
			if (!groups[letter]) {
				groups[letter] = [];
			}
			groups[letter].push(contact);
		}
		return groups;
	}

	async function loadContacts() {
		isLoading = true;
		const token = api.getToken();

		try {
			const res = await fetch('/api/v1/contacts', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (res.ok) {
				contacts = await res.json();
			}
		} catch (e) {
			console.error('Error loading contacts:', e);
		}

		isLoading = false;
	}

	function selectContact(contact: Contact) {
		selectedContact = contact;
		isEditing = false;
	}

	function newContact() {
		selectedContact = null;
		resetForm();
		isEditing = true;
	}

	function editContact() {
		if (!selectedContact) return;
		editFirstName = selectedContact.firstName;
		editLastName = selectedContact.lastName || '';
		editEmail = selectedContact.email || '';
		editPhone = selectedContact.phone || '';
		editMobile = selectedContact.mobile || '';
		editCompany = selectedContact.company || '';
		editJobTitle = selectedContact.jobTitle || '';
		editAddress = selectedContact.address || '';
		editCity = selectedContact.city || '';
		editCountry = selectedContact.country || '';
		editPostalCode = selectedContact.postalCode || '';
		editBirthday = selectedContact.birthday ? selectedContact.birthday.split('T')[0] : '';
		editNotes = selectedContact.notes || '';
		isEditing = true;
	}

	function resetForm() {
		editFirstName = '';
		editLastName = '';
		editEmail = '';
		editPhone = '';
		editMobile = '';
		editCompany = '';
		editJobTitle = '';
		editAddress = '';
		editCity = '';
		editCountry = '';
		editPostalCode = '';
		editBirthday = '';
		editNotes = '';
	}

	function cancelEdit() {
		isEditing = false;
		if (!selectedContact) {
			resetForm();
		}
	}

	async function saveContact() {
		if (!editFirstName.trim()) return;

		isSaving = true;
		const token = api.getToken();

		const contactData = {
			firstName: editFirstName,
			lastName: editLastName || null,
			email: editEmail || null,
			phone: editPhone || null,
			mobile: editMobile || null,
			company: editCompany || null,
			jobTitle: editJobTitle || null,
			address: editAddress || null,
			city: editCity || null,
			country: editCountry || null,
			postalCode: editPostalCode || null,
			birthday: editBirthday ? new Date(editBirthday).toISOString() : null,
			notes: editNotes || null
		};

		try {
			if (selectedContact) {
				const res = await fetch(`/api/v1/contacts/${selectedContact.id}`, {
					method: 'PUT',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(contactData)
				});
				if (res.ok) {
					const updated = await res.json();
					contacts = contacts.map((c) => (c.id === updated.id ? updated : c));
					selectedContact = updated;
				}
			} else {
				const res = await fetch('/api/v1/contacts', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(contactData)
				});
				if (res.ok) {
					const created = await res.json();
					contacts = [...contacts, created].sort((a, b) => a.firstName.localeCompare(b.firstName));
					selectedContact = created;
				}
			}
			isEditing = false;
		} catch (e) {
			console.error('Error saving contact:', e);
		}

		isSaving = false;
	}

	async function deleteContact() {
		if (!selectedContact) return;

		const token = api.getToken();
		try {
			await fetch(`/api/v1/contacts/${selectedContact.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
			contacts = contacts.filter((c) => c.id !== selectedContact!.id);
			selectedContact = null;
			showDeleteConfirm = false;
		} catch (e) {
			console.error('Error deleting contact:', e);
		}
	}

	async function toggleFavorite(contact: Contact) {
		const token = api.getToken();
		try {
			const res = await fetch(`/api/v1/contacts/${contact.id}/favorite`, {
				method: 'PUT',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (res.ok) {
				const updated = await res.json();
				contacts = contacts.map((c) => (c.id === updated.id ? updated : c));
				if (selectedContact && selectedContact.id === updated.id) {
					selectedContact = updated;
				}
			}
		} catch (e) {
			console.error('Error toggling favorite:', e);
		}
	}

	function getInitials(contact: Contact): string {
		const first = contact.firstName[0] || '';
		const last = contact.lastName ? contact.lastName[0] : '';
		return (first + last).toUpperCase();
	}

	function getDisplayName(contact: Contact): string {
		return contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.firstName;
	}

	function getAvatarColor(name: string): string {
		const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}
</script>

<div class="contacts-page">
	<!-- Sidebar -->
	<aside class="contacts-sidebar">
		<div class="sidebar-header">
			<a href="/files" class="back-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12" />
					<polyline points="12 19 5 12 12 5" />
				</svg>
			</a>
			<h1>Contactos</h1>
			<button class="btn-icon" on:click={newContact} title="Nuevo contacto">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
		</div>

		<div class="search-box">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input type="text" placeholder="Buscar contactos..." bind:value={searchQuery} />
		</div>

		<div class="contacts-list">
			{#if isLoading}
				<div class="loading-state">
					<div class="spinner"></div>
				</div>
			{:else if contacts.length === 0}
				<div class="empty-state">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
					<p>No hay contactos</p>
					<button class="btn btn-primary btn-sm" on:click={newContact}>Agregar contacto</button>
				</div>
			{:else}
				{#each Object.keys(groupedContacts).sort() as letter}
					<div class="contact-group">
						<div class="group-letter">{letter}</div>
						{#each groupedContacts[letter] as contact}
							<button class="contact-item" class:active={selectedContact?.id === contact.id} on:click={() => selectContact(contact)}>
								<div class="contact-avatar" style="background: {getAvatarColor(contact.firstName)}">
									{getInitials(contact)}
								</div>
								<div class="contact-info">
									<span class="contact-name">{getDisplayName(contact)}</span>
									{#if contact.company}
										<span class="contact-company">{contact.company}</span>
									{/if}
								</div>
								{#if contact.isFavorite}
									<svg class="favorite-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
										<path d="M12 2L9.19 8.63L2 9.24L7.46 14.22L5.82 21.24L12 17.77L18.18 21.24L16.54 14.22L22 9.24L14.81 8.63L12 2Z" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			{/if}
		</div>
	</aside>

	<!-- Detail View -->
	<main class="contact-detail">
		{#if isEditing}
			<div class="edit-form">
				<div class="form-header">
					<h2>{selectedContact ? 'Editar contacto' : 'Nuevo contacto'}</h2>
					<div class="form-actions">
						<button class="btn btn-secondary" on:click={cancelEdit}>Cancelar</button>
						<button class="btn btn-primary" on:click={saveContact} disabled={isSaving}>
							{isSaving ? 'Guardando...' : 'Guardar'}
						</button>
					</div>
				</div>

				<div class="form-body">
					<div class="form-section">
						<h3>Información personal</h3>
						<div class="form-row">
							<div class="form-group">
								<label for="firstName">Nombre *</label>
								<input type="text" id="firstName" bind:value={editFirstName} placeholder="Nombre" required />
							</div>
							<div class="form-group">
								<label for="lastName">Apellido</label>
								<input type="text" id="lastName" bind:value={editLastName} placeholder="Apellido" />
							</div>
						</div>
						<div class="form-group">
							<label for="birthday">Cumpleaños</label>
							<input type="date" id="birthday" bind:value={editBirthday} />
						</div>
					</div>

					<div class="form-section">
						<h3>Contacto</h3>
						<div class="form-group">
							<label for="email">Email</label>
							<input type="email" id="email" bind:value={editEmail} placeholder="email@ejemplo.com" />
						</div>
						<div class="form-row">
							<div class="form-group">
								<label for="phone">Teléfono</label>
								<input type="tel" id="phone" bind:value={editPhone} placeholder="+1 234 567 890" />
							</div>
							<div class="form-group">
								<label for="mobile">Móvil</label>
								<input type="tel" id="mobile" bind:value={editMobile} placeholder="+1 234 567 890" />
							</div>
						</div>
					</div>

					<div class="form-section">
						<h3>Trabajo</h3>
						<div class="form-row">
							<div class="form-group">
								<label for="company">Empresa</label>
								<input type="text" id="company" bind:value={editCompany} placeholder="Empresa" />
							</div>
							<div class="form-group">
								<label for="jobTitle">Cargo</label>
								<input type="text" id="jobTitle" bind:value={editJobTitle} placeholder="Cargo" />
							</div>
						</div>
					</div>

					<div class="form-section">
						<h3>Dirección</h3>
						<div class="form-group">
							<label for="address">Calle</label>
							<input type="text" id="address" bind:value={editAddress} placeholder="Dirección" />
						</div>
						<div class="form-row">
							<div class="form-group">
								<label for="city">Ciudad</label>
								<input type="text" id="city" bind:value={editCity} placeholder="Ciudad" />
							</div>
							<div class="form-group">
								<label for="postalCode">Código postal</label>
								<input type="text" id="postalCode" bind:value={editPostalCode} placeholder="12345" />
							</div>
						</div>
						<div class="form-group">
							<label for="country">País</label>
							<input type="text" id="country" bind:value={editCountry} placeholder="País" />
						</div>
					</div>

					<div class="form-section">
						<h3>Notas</h3>
						<div class="form-group">
							<textarea id="notes" bind:value={editNotes} placeholder="Notas adicionales..." rows="4"></textarea>
						</div>
					</div>
				</div>
			</div>
		{:else if selectedContact}
			<div class="contact-view">
				<div class="view-header">
					<div class="contact-avatar-large" style="background: {getAvatarColor(selectedContact.firstName)}">
						{getInitials(selectedContact)}
					</div>
					<div class="contact-main-info">
						<h2>{getDisplayName(selectedContact)}</h2>
						{#if selectedContact.jobTitle || selectedContact.company}
							<p class="subtitle">
								{selectedContact.jobTitle || ''}{selectedContact.jobTitle && selectedContact.company ? ' en ' : ''}{selectedContact.company || ''}
							</p>
						{/if}
					</div>
					<div class="view-actions">
						<button class="btn-icon" on:click={() => toggleFavorite(selectedContact)} title={selectedContact.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill={selectedContact.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
								<path d="M12 2L9.19 8.63L2 9.24L7.46 14.22L5.82 21.24L12 17.77L18.18 21.24L16.54 14.22L22 9.24L14.81 8.63L12 2Z" />
							</svg>
						</button>
						<button class="btn btn-secondary" on:click={editContact}>Editar</button>
						<button class="btn-icon danger" on:click={() => (showDeleteConfirm = true)} title="Eliminar">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="3 6 5 6 21 6" />
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
						</button>
					</div>
				</div>

				<div class="contact-details">
					{#if selectedContact.email || selectedContact.phone || selectedContact.mobile}
						<div class="detail-section">
							<h3>Contacto</h3>
							{#if selectedContact.email}
								<div class="detail-row">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
										<polyline points="22,6 12,13 2,6" />
									</svg>
									<a href="mailto:{selectedContact.email}">{selectedContact.email}</a>
								</div>
							{/if}
							{#if selectedContact.phone}
								<div class="detail-row">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
									</svg>
									<a href="tel:{selectedContact.phone}">{selectedContact.phone}</a>
									<span class="label">Teléfono</span>
								</div>
							{/if}
							{#if selectedContact.mobile}
								<div class="detail-row">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
										<line x1="12" y1="18" x2="12.01" y2="18" />
									</svg>
									<a href="tel:{selectedContact.mobile}">{selectedContact.mobile}</a>
									<span class="label">Móvil</span>
								</div>
							{/if}
						</div>
					{/if}

					{#if selectedContact.address || selectedContact.city || selectedContact.country}
						<div class="detail-section">
							<h3>Dirección</h3>
							<div class="detail-row">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
									<circle cx="12" cy="10" r="3" />
								</svg>
								<div class="address-block">
									{#if selectedContact.address}<p>{selectedContact.address}</p>{/if}
									{#if selectedContact.city || selectedContact.postalCode}
										<p>{selectedContact.postalCode || ''} {selectedContact.city || ''}</p>
									{/if}
									{#if selectedContact.country}<p>{selectedContact.country}</p>{/if}
								</div>
							</div>
						</div>
					{/if}

					{#if selectedContact.birthday}
						<div class="detail-section">
							<h3>Cumpleaños</h3>
							<div class="detail-row">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
									<line x1="16" y1="2" x2="16" y2="6" />
									<line x1="8" y1="2" x2="8" y2="6" />
									<line x1="3" y1="10" x2="21" y2="10" />
								</svg>
								<span>{new Date(selectedContact.birthday).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
							</div>
						</div>
					{/if}

					{#if selectedContact.notes}
						<div class="detail-section">
							<h3>Notas</h3>
							<p class="notes-text">{selectedContact.notes}</p>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="no-selection">
				<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
					<circle cx="12" cy="7" r="4" />
				</svg>
				<p>Selecciona un contacto o crea uno nuevo</p>
				<button class="btn btn-primary" on:click={newContact}>Nuevo contacto</button>
			</div>
		{/if}
	</main>
</div>

<!-- Delete Confirm Modal -->
{#if showDeleteConfirm}
	<div class="modal-overlay" on:click={() => (showDeleteConfirm = false)}>
		<div class="modal confirm-modal" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Eliminar contacto</h2>
			</div>
			<div class="modal-body">
				<p>¿Estás seguro de que deseas eliminar a <strong>{selectedContact ? getDisplayName(selectedContact) : ''}</strong>?</p>
				<p class="warning">Esta acción no se puede deshacer.</p>
			</div>
			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={() => (showDeleteConfirm = false)}>Cancelar</button>
				<button class="btn btn-danger" on:click={deleteContact}>Eliminar</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.contacts-page {
		display: flex;
		height: 100vh;
		background: var(--bg);
	}

	.contacts-sidebar {
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
	}

	.back-link:hover {
		background: var(--bg-hover);
		color: var(--text);
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}

	.search-box svg {
		color: var(--text-muted);
	}

	.search-box input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text);
		font-size: 14px;
		outline: none;
	}

	.contacts-list {
		flex: 1;
		overflow-y: auto;
	}

	.contact-group {
		padding: 8px 0;
	}

	.group-letter {
		padding: 8px 16px;
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		background: var(--bg);
		position: sticky;
		top: 0;
	}

	.contact-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 16px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.contact-item:hover {
		background: var(--bg-hover);
	}

	.contact-item.active {
		background: var(--bg-hover);
		border-left: 3px solid var(--primary);
	}

	.contact-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 600;
		color: white;
	}

	.contact-info {
		flex: 1;
		min-width: 0;
	}

	.contact-name {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
	}

	.contact-company {
		display: block;
		font-size: 12px;
		color: var(--text-muted);
	}

	.favorite-icon {
		color: var(--warning);
	}

	.contact-detail {
		flex: 1;
		overflow-y: auto;
	}

	.no-selection {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: var(--text-secondary);
	}

	.contact-view {
		padding: 24px;
	}

	.view-header {
		display: flex;
		align-items: flex-start;
		gap: 20px;
		margin-bottom: 32px;
	}

	.contact-avatar-large {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28px;
		font-weight: 600;
		color: white;
	}

	.contact-main-info {
		flex: 1;
	}

	.contact-main-info h2 {
		font-size: 24px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.contact-main-info .subtitle {
		color: var(--text-secondary);
		font-size: 14px;
	}

	.view-actions {
		display: flex;
		gap: 8px;
	}

	.btn-icon.danger {
		color: var(--error);
	}

	.contact-details {
		max-width: 600px;
	}

	.detail-section {
		margin-bottom: 24px;
	}

	.detail-section h3 {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.detail-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 8px 0;
	}

	.detail-row svg {
		color: var(--text-muted);
		margin-top: 2px;
	}

	.detail-row a {
		color: var(--primary);
		text-decoration: none;
	}

	.detail-row a:hover {
		text-decoration: underline;
	}

	.detail-row .label {
		font-size: 12px;
		color: var(--text-muted);
		margin-left: 8px;
	}

	.address-block p {
		margin: 0;
		line-height: 1.5;
	}

	.notes-text {
		color: var(--text-secondary);
		line-height: 1.6;
		white-space: pre-wrap;
	}

	/* Edit Form */
	.edit-form {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.form-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
	}

	.form-header h2 {
		font-size: 18px;
		font-weight: 600;
	}

	.form-actions {
		display: flex;
		gap: 8px;
	}

	.form-body {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
	}

	.form-section {
		margin-bottom: 32px;
	}

	.form-section h3 {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 16px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text);
		font-size: 14px;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		border-color: var(--primary);
		outline: none;
	}

	.form-row {
		display: flex;
		gap: 16px;
	}

	.form-row .form-group {
		flex: 1;
	}

	/* Loading & Empty States */
	.loading-state,
	.empty-state {
		padding: 40px 20px;
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: var(--bg-card);
		border-radius: 16px;
		width: 100%;
		max-width: 400px;
	}

	.modal-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		font-size: 16px;
		font-weight: 600;
	}

	.modal-body {
		padding: 20px;
	}

	.modal-body .warning {
		color: var(--error);
		font-size: 13px;
		margin-top: 8px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 16px 20px;
		border-top: 1px solid var(--border);
	}

	.btn-danger {
		background: var(--error);
		color: white;
	}

	@media (max-width: 768px) {
		.contacts-sidebar {
			width: 100%;
			position: absolute;
			z-index: 10;
		}
	}
</style>
