<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';

	interface CalendarEvent {
		id: string;
		title: string;
		description: string | null;
		startDate: string;
		endDate: string;
		isAllDay: boolean;
		location: string | null;
		color: string | null;
		recurrenceRule: string | null;
		reminderMinutes: number | null;
		calendarID: string;
	}

	let events: CalendarEvent[] = [];
	let isLoading = true;
	let currentDate = new Date();
	let viewMode: 'month' | 'week' | 'day' = 'month';
	let selectedEvent: CalendarEvent | null = null;
	let showEventModal = false;
	let isEditing = false;
	let isSaving = false;

	// Form fields
	let editTitle = '';
	let editDescription = '';
	let editStartDate = '';
	let editStartTime = '';
	let editEndDate = '';
	let editEndTime = '';
	let editIsAllDay = false;
	let editLocation = '';
	let editColor = '#0082c9';

	const colors = [
		{ value: '#0082c9', label: 'Azul' },
		{ value: '#46ba61', label: 'Verde' },
		{ value: '#e9322d', label: 'Rojo' },
		{ value: '#ec6842', label: 'Naranja' },
		{ value: '#f9d42b', label: 'Amarillo' },
		{ value: '#8b5cf6', label: 'Violeta' },
		{ value: '#ec4899', label: 'Rosa' }
	];

	const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
	const monthNames = [
		'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
		'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
	];

	$: if (!$auth.isLoading && !$auth.isAuthenticated) {
		goto('/auth/login');
	}

	$: calendarDays = generateCalendarDays(currentDate);
	$: monthLabel = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

	onMount(async () => {
		if ($auth.isAuthenticated) {
			await loadEvents();
		}
	});

	function generateCalendarDays(date: Date) {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startPadding = firstDay.getDay();
		const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];

		// Previous month padding
		for (let i = startPadding - 1; i >= 0; i--) {
			const d = new Date(year, month, -i);
			days.push({ date: d, isCurrentMonth: false, isToday: false });
		}

		// Current month
		const today = new Date();
		for (let i = 1; i <= lastDay.getDate(); i++) {
			const d = new Date(year, month, i);
			const isToday = d.toDateString() === today.toDateString();
			days.push({ date: d, isCurrentMonth: true, isToday });
		}

		// Next month padding
		const remaining = 42 - days.length;
		for (let i = 1; i <= remaining; i++) {
			const d = new Date(year, month + 1, i);
			days.push({ date: d, isCurrentMonth: false, isToday: false });
		}

		return days;
	}

	async function loadEvents() {
		isLoading = true;
		const token = api.getToken();

		const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
		const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);

		try {
			const res = await fetch(
				`/api/v1/events/range?start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			);
			if (res.ok) {
				events = await res.json();
			}
		} catch (e) {
			console.error('Error loading events:', e);
		}

		isLoading = false;
	}

	function getEventsForDay(date: Date): CalendarEvent[] {
		return events.filter((event) => {
			const eventStart = new Date(event.startDate);
			const eventEnd = new Date(event.endDate);
			const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
			const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
			return eventStart <= dayEnd && eventEnd >= dayStart;
		});
	}

	function previousMonth() {
		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
		loadEvents();
	}

	function nextMonth() {
		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
		loadEvents();
	}

	function goToToday() {
		currentDate = new Date();
		loadEvents();
	}

	function openNewEvent(date?: Date) {
		selectedEvent = null;
		isEditing = true;
		const d = date || new Date();
		editTitle = '';
		editDescription = '';
		editStartDate = formatDateForInput(d);
		editStartTime = '09:00';
		editEndDate = formatDateForInput(d);
		editEndTime = '10:00';
		editIsAllDay = false;
		editLocation = '';
		editColor = '#0082c9';
		showEventModal = true;
	}

	function openEvent(event: CalendarEvent) {
		selectedEvent = event;
		isEditing = false;
		editTitle = event.title;
		editDescription = event.description || '';
		const start = new Date(event.startDate);
		const end = new Date(event.endDate);
		editStartDate = formatDateForInput(start);
		editStartTime = formatTimeForInput(start);
		editEndDate = formatDateForInput(end);
		editEndTime = formatTimeForInput(end);
		editIsAllDay = event.isAllDay;
		editLocation = event.location || '';
		editColor = event.color || '#0082c9';
		showEventModal = true;
	}

	function startEditing() {
		isEditing = true;
	}

	function formatDateForInput(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	function formatTimeForInput(date: Date): string {
		return date.toTimeString().slice(0, 5);
	}

	async function saveEvent() {
		if (!editTitle.trim()) return;

		isSaving = true;
		const token = api.getToken();

		const startDate = editIsAllDay
			? new Date(`${editStartDate}T00:00:00`)
			: new Date(`${editStartDate}T${editStartTime}:00`);

		const endDate = editIsAllDay
			? new Date(`${editEndDate}T23:59:59`)
			: new Date(`${editEndDate}T${editEndTime}:00`);

		const eventData = {
			title: editTitle,
			description: editDescription || null,
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			isAllDay: editIsAllDay,
			location: editLocation || null,
			color: editColor
		};

		try {
			if (selectedEvent) {
				const res = await fetch(`/api/v1/events/${selectedEvent.id}`, {
					method: 'PUT',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(eventData)
				});
				if (res.ok) {
					const updated = await res.json();
					events = events.map((e) => (e.id === updated.id ? updated : e));
					selectedEvent = updated;
				}
			} else {
				const res = await fetch('/api/v1/events', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(eventData)
				});
				if (res.ok) {
					const created = await res.json();
					events = [...events, created];
					selectedEvent = created;
				}
			}
			isEditing = false;
		} catch (e) {
			console.error('Error saving event:', e);
		}

		isSaving = false;
	}

	async function deleteEvent() {
		if (!selectedEvent || !confirm('¿Eliminar este evento?')) return;

		const token = api.getToken();
		try {
			await fetch(`/api/v1/events/${selectedEvent.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` }
			});
			events = events.filter((e) => e.id !== selectedEvent!.id);
			showEventModal = false;
			selectedEvent = null;
		} catch (e) {
			console.error('Error deleting event:', e);
		}
	}

	function closeModal() {
		showEventModal = false;
		selectedEvent = null;
		isEditing = false;
	}

	function formatEventTime(event: CalendarEvent): string {
		if (event.isAllDay) return 'Todo el día';
		const start = new Date(event.startDate);
		return start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="calendar-page">
	<!-- Sidebar -->
	<aside class="calendar-sidebar">
		<div class="sidebar-header">
			<a href="/files" class="back-link">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="12" x2="5" y2="12" />
					<polyline points="12 19 5 12 12 5" />
				</svg>
			</a>
			<h1>Calendario</h1>
		</div>

		<button class="btn btn-primary new-event-btn" on:click={() => openNewEvent()}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Nuevo evento
		</button>

		<div class="mini-calendar">
			<div class="mini-header">
				<button on:click={previousMonth}>&lt;</button>
				<span>{monthLabel}</span>
				<button on:click={nextMonth}>&gt;</button>
			</div>
			<div class="mini-grid">
				{#each weekDays as day}
					<span class="mini-day-name">{day[0]}</span>
				{/each}
				{#each calendarDays.slice(0, 35) as day}
					<button
						class="mini-day"
						class:other-month={!day.isCurrentMonth}
						class:today={day.isToday}
						on:click={() => {
							currentDate = new Date(day.date);
						}}
					>
						{day.date.getDate()}
					</button>
				{/each}
			</div>
		</div>

		<div class="upcoming-events">
			<h3>Próximos eventos</h3>
			{#each events.slice(0, 5) as event}
				<button class="upcoming-event" on:click={() => openEvent(event)}>
					<div class="event-dot" style="background: {event.color || '#0082c9'}"></div>
					<div class="event-info">
						<span class="event-title">{event.title}</span>
						<span class="event-date">{new Date(event.startDate).toLocaleDateString('es-ES')}</span>
					</div>
				</button>
			{/each}
		</div>
	</aside>

	<!-- Main Calendar -->
	<main class="calendar-main">
		<div class="calendar-header">
			<div class="nav-controls">
				<button class="btn btn-secondary" on:click={goToToday}>Hoy</button>
				<button class="btn-icon" on:click={previousMonth}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
				<button class="btn-icon" on:click={nextMonth}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>
				<h2>{monthLabel}</h2>
			</div>
			<div class="view-controls">
				<button class="btn-view" class:active={viewMode === 'month'} on:click={() => (viewMode = 'month')}>Mes</button>
				<button class="btn-view" class:active={viewMode === 'week'} on:click={() => (viewMode = 'week')}>Semana</button>
				<button class="btn-view" class:active={viewMode === 'day'} on:click={() => (viewMode = 'day')}>Día</button>
			</div>
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
			</div>
		{:else}
			<div class="calendar-grid">
				<div class="day-names">
					{#each weekDays as day}
						<div class="day-name">{day}</div>
					{/each}
				</div>
				<div class="days-grid">
					{#each calendarDays as day}
						<div
							class="calendar-day"
							class:other-month={!day.isCurrentMonth}
							class:today={day.isToday}
							on:dblclick={() => openNewEvent(day.date)}
						>
							<span class="day-number">{day.date.getDate()}</span>
							<div class="day-events">
								{#each getEventsForDay(day.date).slice(0, 3) as event}
									<button
										class="event-chip"
										style="background: {event.color || '#0082c9'}"
										on:click|stopPropagation={() => openEvent(event)}
									>
										<span class="event-time">{formatEventTime(event)}</span>
										<span class="event-name">{event.title}</span>
									</button>
								{/each}
								{#if getEventsForDay(day.date).length > 3}
									<span class="more-events">+{getEventsForDay(day.date).length - 3} más</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Event Modal -->
{#if showEventModal}
	<div class="modal-overlay" on:click={closeModal}>
		<div class="modal event-modal" on:click|stopPropagation>
			<div class="modal-header">
				<h2>{selectedEvent && !isEditing ? selectedEvent.title : isEditing ? (selectedEvent ? 'Editar evento' : 'Nuevo evento') : ''}</h2>
				<button class="btn-icon" on:click={closeModal}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{#if isEditing}
				<div class="modal-body">
					<div class="form-group">
						<label for="title">Título</label>
						<input type="text" id="title" bind:value={editTitle} placeholder="Título del evento" />
					</div>

					<div class="form-row">
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={editIsAllDay} />
							Todo el día
						</label>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="startDate">Inicio</label>
							<input type="date" id="startDate" bind:value={editStartDate} />
						</div>
						{#if !editIsAllDay}
							<div class="form-group">
								<label for="startTime">Hora</label>
								<input type="time" id="startTime" bind:value={editStartTime} />
							</div>
						{/if}
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="endDate">Fin</label>
							<input type="date" id="endDate" bind:value={editEndDate} />
						</div>
						{#if !editIsAllDay}
							<div class="form-group">
								<label for="endTime">Hora</label>
								<input type="time" id="endTime" bind:value={editEndTime} />
							</div>
						{/if}
					</div>

					<div class="form-group">
						<label for="location">Ubicación</label>
						<input type="text" id="location" bind:value={editLocation} placeholder="Añadir ubicación" />
					</div>

					<div class="form-group">
						<label for="description">Descripción</label>
						<textarea id="description" bind:value={editDescription} placeholder="Añadir descripción" rows="3"></textarea>
					</div>

					<div class="form-group">
						<label>Color</label>
						<div class="color-options">
							{#each colors as color}
								<button
									class="color-option"
									class:active={editColor === color.value}
									style="background: {color.value}"
									on:click={() => (editColor = color.value)}
									title={color.label}
								></button>
							{/each}
						</div>
					</div>
				</div>

				<div class="modal-footer">
					{#if selectedEvent}
						<button class="btn btn-danger" on:click={deleteEvent}>Eliminar</button>
					{/if}
					<div class="spacer"></div>
					<button class="btn btn-secondary" on:click={closeModal}>Cancelar</button>
					<button class="btn btn-primary" on:click={saveEvent} disabled={isSaving}>
						{isSaving ? 'Guardando...' : 'Guardar'}
					</button>
				</div>
			{:else if selectedEvent}
				<div class="modal-body event-view">
					<div class="event-detail">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<polyline points="12 6 12 12 16 14" />
						</svg>
						<div>
							<p>{new Date(selectedEvent.startDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
							{#if !selectedEvent.isAllDay}
								<p class="time">{formatEventTime(selectedEvent)} - {new Date(selectedEvent.endDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
							{:else}
								<p class="time">Todo el día</p>
							{/if}
						</div>
					</div>

					{#if selectedEvent.location}
						<div class="event-detail">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
								<circle cx="12" cy="10" r="3" />
							</svg>
							<p>{selectedEvent.location}</p>
						</div>
					{/if}

					{#if selectedEvent.description}
						<div class="event-detail">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="17" y1="10" x2="3" y2="10" />
								<line x1="21" y1="6" x2="3" y2="6" />
								<line x1="21" y1="14" x2="3" y2="14" />
								<line x1="17" y1="18" x2="3" y2="18" />
							</svg>
							<p>{selectedEvent.description}</p>
						</div>
					{/if}
				</div>

				<div class="modal-footer">
					<button class="btn btn-danger" on:click={deleteEvent}>Eliminar</button>
					<div class="spacer"></div>
					<button class="btn btn-primary" on:click={startEditing}>Editar</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.calendar-page {
		display: flex;
		height: 100vh;
		background: var(--bg);
	}

	.calendar-sidebar {
		width: 280px;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 16px;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}

	.sidebar-header h1 {
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

	.new-event-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		margin-bottom: 20px;
	}

	.mini-calendar {
		background: var(--bg-card);
		border-radius: 12px;
		padding: 12px;
		margin-bottom: 20px;
	}

	.mini-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		font-size: 13px;
		font-weight: 500;
	}

	.mini-header button {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 4px 8px;
	}

	.mini-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.mini-day-name {
		text-align: center;
		font-size: 10px;
		color: var(--text-muted);
		padding: 4px;
	}

	.mini-day {
		text-align: center;
		font-size: 11px;
		padding: 4px;
		background: none;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		color: var(--text);
	}

	.mini-day.other-month {
		color: var(--text-muted);
	}

	.mini-day.today {
		background: var(--primary);
		color: white;
	}

	.mini-day:hover:not(.today) {
		background: var(--bg-hover);
	}

	.upcoming-events {
		flex: 1;
		overflow-y: auto;
	}

	.upcoming-events h3 {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.upcoming-event {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		width: 100%;
		padding: 10px;
		background: var(--bg-card);
		border: none;
		border-radius: 8px;
		margin-bottom: 8px;
		cursor: pointer;
		text-align: left;
	}

	.upcoming-event:hover {
		background: var(--bg-hover);
	}

	.event-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-top: 4px;
	}

	.event-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.event-info .event-title {
		font-size: 13px;
		color: var(--text);
	}

	.event-info .event-date {
		font-size: 11px;
		color: var(--text-muted);
	}

	.calendar-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
	}

	.nav-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.nav-controls h2 {
		font-size: 20px;
		font-weight: 600;
		margin-left: 8px;
	}

	.view-controls {
		display: flex;
		background: var(--bg-secondary);
		border-radius: 8px;
		padding: 4px;
	}

	.btn-view {
		padding: 8px 16px;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 6px;
		font-size: 13px;
	}

	.btn-view.active {
		background: var(--primary);
		color: white;
	}

	.calendar-grid {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.day-names {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		border-bottom: 1px solid var(--border);
	}

	.day-name {
		padding: 12px;
		text-align: center;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.days-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-template-rows: repeat(6, 1fr);
	}

	.calendar-day {
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		padding: 8px;
		min-height: 100px;
		cursor: pointer;
	}

	.calendar-day:hover {
		background: var(--bg-hover);
	}

	.calendar-day.other-month {
		background: var(--bg-secondary);
	}

	.calendar-day.other-month .day-number {
		color: var(--text-muted);
	}

	.day-number {
		font-size: 14px;
		font-weight: 500;
		margin-bottom: 4px;
	}

	.calendar-day.today .day-number {
		background: var(--primary);
		color: white;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
	}

	.day-events {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.event-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 11px;
		color: white;
		border: none;
		cursor: pointer;
		text-align: left;
		overflow: hidden;
	}

	.event-chip:hover {
		filter: brightness(1.1);
	}

	.event-time {
		font-weight: 500;
		white-space: nowrap;
	}

	.event-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.more-events {
		font-size: 11px;
		color: var(--text-muted);
		padding: 2px 4px;
	}

	.loading-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
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
		max-width: 480px;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		font-size: 16px;
		font-weight: 600;
	}

	.modal-body {
		padding: 20px;
		overflow-y: auto;
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
		gap: 12px;
		margin-bottom: 16px;
	}

	.form-row .form-group {
		flex: 1;
		margin-bottom: 0;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		cursor: pointer;
	}

	.color-options {
		display: flex;
		gap: 8px;
	}

	.color-option {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.15s;
	}

	.color-option:hover {
		transform: scale(1.15);
	}

	.color-option.active {
		border-color: white;
		box-shadow: 0 0 0 2px var(--primary);
	}

	.modal-footer {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		border-top: 1px solid var(--border);
	}

	.spacer {
		flex: 1;
	}

	.btn-danger {
		background: var(--error);
		color: white;
	}

	.event-view .event-detail {
		display: flex;
		gap: 12px;
		margin-bottom: 16px;
	}

	.event-detail svg {
		color: var(--text-muted);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.event-detail p {
		font-size: 14px;
		color: var(--text);
	}

	.event-detail .time {
		color: var(--text-secondary);
		font-size: 13px;
	}

	@media (max-width: 768px) {
		.calendar-sidebar {
			display: none;
		}
	}
</style>
