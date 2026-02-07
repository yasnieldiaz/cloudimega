import { writable, get } from 'svelte/store';
import { api, type Folder, type CloudFile, type Tag, type SearchResult } from '$lib/api/client';

type ViewMode = 'all' | 'recent' | 'favorites' | 'shared' | 'trash' | 'search' | 'tag';

interface FilesState {
	currentFolder: Folder | null;
	folders: Folder[];
	files: CloudFile[];
	path: Folder[];
	isLoading: boolean;
	error: string | null;
	viewMode: ViewMode;
	searchQuery: string;
	searchResults: SearchResult | null;
	tags: Tag[];
	currentTag: Tag | null;
	trashFiles: CloudFile[];
	favoriteFiles: CloudFile[];
	favoriteFolders: Folder[];
}

function createFilesStore() {
	const { subscribe, set, update } = writable<FilesState>({
		currentFolder: null,
		folders: [],
		files: [],
		path: [],
		isLoading: false,
		error: null,
		viewMode: 'all',
		searchQuery: '',
		searchResults: null,
		tags: [],
		currentTag: null,
		trashFiles: [],
		favoriteFiles: [],
		favoriteFolders: []
	});

	return {
		subscribe,

		setViewMode(mode: ViewMode) {
			update(s => ({ ...s, viewMode: mode }));
		},

		async loadRoot() {
			update(s => ({ ...s, isLoading: true, error: null, viewMode: 'all' }));

			const { data, error } = await api.getRootFolder();
			if (error) {
				update(s => ({ ...s, isLoading: false, error }));
				return;
			}

			if (data) {
				await this.loadFolder(data.id);
				update(s => ({ ...s, path: [data] }));
			}
		},

		async loadFolder(folderId: string) {
			update(s => ({ ...s, isLoading: true, error: null }));

			const { data, error } = await api.getFolderContents(folderId);
			if (error) {
				update(s => ({ ...s, isLoading: false, error }));
				return;
			}

			if (data) {
				update(s => ({
					...s,
					currentFolder: data.folder,
					folders: data.folders,
					files: data.files,
					isLoading: false,
					viewMode: 'all'
				}));
			}
		},

		async navigateTo(folder: Folder) {
			await this.loadFolder(folder.id);

			update(s => {
				const pathIndex = s.path.findIndex(f => f.id === folder.id);
				if (pathIndex >= 0) {
					return { ...s, path: s.path.slice(0, pathIndex + 1) };
				} else {
					return { ...s, path: [...s.path, folder] };
				}
			});
		},

		async createFolder(name: string) {
			const state = get({ subscribe });
			const currentFolderId = state.currentFolder?.id;

			const { data, error } = await api.createFolder(name, currentFolderId);
			if (error) {
				return { success: false, error };
			}

			if (data) {
				update(s => ({
					...s,
					folders: [...s.folders, data]
				}));
			}

			return { success: true };
		},

		async uploadFile(file: File) {
			const state = get({ subscribe });
			const currentFolderId = state.currentFolder?.id;

			const { data, error } = await api.uploadFile(file, currentFolderId);
			if (error) {
				return { success: false, error };
			}

			if (data) {
				update(s => ({
					...s,
					files: [...s.files, data]
				}));
			}

			return { success: true };
		},

		async deleteFile(fileId: string) {
			const { error } = await api.deleteFile(fileId);
			if (error) {
				return { success: false, error };
			}

			update(s => ({
				...s,
				files: s.files.filter(f => f.id !== fileId)
			}));

			return { success: true };
		},

		async deleteFolder(folderId: string) {
			const { error } = await api.deleteFolder(folderId);
			if (error) {
				return { success: false, error };
			}

			update(s => ({
				...s,
				folders: s.folders.filter(f => f.id !== folderId)
			}));

			return { success: true };
		},

		// Trash operations
		async loadTrash() {
			update(s => ({ ...s, isLoading: true, error: null, viewMode: 'trash' }));

			const { data, error } = await api.getTrash();
			if (error) {
				update(s => ({ ...s, isLoading: false, error }));
				return;
			}

			update(s => ({
				...s,
				trashFiles: data || [],
				files: data || [],
				folders: [],
				isLoading: false
			}));
		},

		async restoreFile(fileId: string) {
			const { data, error } = await api.restoreFile(fileId);
			if (error) {
				return { success: false, error };
			}

			update(s => ({
				...s,
				trashFiles: s.trashFiles.filter(f => f.id !== fileId),
				files: s.files.filter(f => f.id !== fileId)
			}));

			return { success: true, data };
		},

		async permanentDeleteFile(fileId: string) {
			const { error } = await api.permanentDeleteFile(fileId);
			if (error) {
				return { success: false, error };
			}

			update(s => ({
				...s,
				trashFiles: s.trashFiles.filter(f => f.id !== fileId),
				files: s.files.filter(f => f.id !== fileId)
			}));

			return { success: true };
		},

		// Favorites operations
		async loadFavorites() {
			update(s => ({ ...s, isLoading: true, error: null, viewMode: 'favorites' }));

			const { data, error } = await api.getFavoritesList();
			if (error) {
				update(s => ({ ...s, isLoading: false, error }));
				return;
			}

			update(s => ({
				...s,
				favoriteFiles: data?.files || [],
				favoriteFolders: data?.folders || [],
				files: data?.files || [],
				folders: data?.folders || [],
				isLoading: false
			}));
		},

		async toggleFileFavorite(fileId: string, isFavorite: boolean) {
			let result;
			if (isFavorite) {
				result = await api.removeFileFromFavorites(fileId);
			} else {
				result = await api.addFileToFavorites(fileId);
			}

			if (result.error) {
				return { success: false, error: result.error };
			}

			// Update the file's favorite status in state
			update(s => ({
				...s,
				files: s.files.map(f =>
					f.id === fileId ? { ...f, isFavorite: !isFavorite } : f
				)
			}));

			return { success: true };
		},

		async toggleFolderFavorite(folderId: string, isFavorite: boolean) {
			let result;
			if (isFavorite) {
				result = await api.removeFolderFromFavorites(folderId);
			} else {
				result = await api.addFolderToFavorites(folderId);
			}

			if (result.error) {
				return { success: false, error: result.error };
			}

			update(s => ({
				...s,
				folders: s.folders.map(f =>
					f.id === folderId ? { ...f, isFavorite: !isFavorite } : f
				)
			}));

			return { success: true };
		},

		// Search operations
		async search(query: string) {
			if (!query.trim()) {
				update(s => ({ ...s, searchQuery: '', searchResults: null, viewMode: 'all' }));
				return;
			}

			update(s => ({ ...s, isLoading: true, error: null, searchQuery: query, viewMode: 'search' }));

			const { data, error } = await api.search(query);
			if (error) {
				update(s => ({ ...s, isLoading: false, error }));
				return;
			}

			update(s => ({
				...s,
				searchResults: data || null,
				files: data?.files || [],
				folders: data?.folders || [],
				isLoading: false
			}));
		},

		async loadRecent() {
			update(s => ({ ...s, isLoading: true, error: null, viewMode: 'recent' }));

			const { data, error } = await api.getRecentSearchFiles();
			if (error) {
				update(s => ({ ...s, isLoading: false, error }));
				return;
			}

			update(s => ({
				...s,
				files: data || [],
				folders: [],
				isLoading: false
			}));
		},

		// Tags operations
		async loadTags() {
			const { data, error } = await api.getTags();
			if (error) {
				return { success: false, error };
			}

			update(s => ({
				...s,
				tags: data || []
			}));

			return { success: true };
		},

		async loadFilesByTag(tag: Tag) {
			update(s => ({ ...s, isLoading: true, error: null, viewMode: 'tag', currentTag: tag }));

			const { data, error } = await api.getFilesWithTag(tag.id);
			if (error) {
				update(s => ({ ...s, isLoading: false, error }));
				return;
			}

			update(s => ({
				...s,
				files: data || [],
				folders: [],
				isLoading: false
			}));
		},

		async createTag(name: string, color: string) {
			const { data, error } = await api.createTag(name, color);
			if (error) {
				return { success: false, error };
			}

			if (data) {
				update(s => ({
					...s,
					tags: [...s.tags, data]
				}));
			}

			return { success: true, data };
		},

		async deleteTag(tagId: string) {
			const { error } = await api.deleteTag(tagId);
			if (error) {
				return { success: false, error };
			}

			update(s => ({
				...s,
				tags: s.tags.filter(t => t.id !== tagId)
			}));

			return { success: true };
		},

		async addTagToFile(fileId: string, tagId: string) {
			const { error } = await api.addTagToFile(fileId, tagId);
			if (error) {
				return { success: false, error };
			}
			return { success: true };
		},

		async removeTagFromFile(fileId: string, tagId: string) {
			const { error } = await api.removeTagFromFile(fileId, tagId);
			if (error) {
				return { success: false, error };
			}
			return { success: true };
		}
	};
}

export const files = createFilesStore();
