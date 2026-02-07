const API_BASE = '/api/v1';

interface ApiResponse<T> {
	data?: T;
	error?: string;
}

class ApiClient {
	private token: string | null = null;

	setToken(token: string | null) {
		this.token = token;
		if (token) {
			localStorage.setItem('accessToken', token);
		} else {
			localStorage.removeItem('accessToken');
		}
	}

	getToken(): string | null {
		if (!this.token) {
			this.token = localStorage.getItem('accessToken');
		}
		return this.token;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<ApiResponse<T>> {
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
			...options.headers
		};

		const token = this.getToken();
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		try {
			const response = await fetch(`${API_BASE}${endpoint}`, {
				...options,
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return { error: errorData.reason || `Error: ${response.status}` };
			}

			if (response.status === 204) {
				return { data: undefined as T };
			}

			const data = await response.json();
			return { data };
		} catch (err) {
			return { error: 'Network error' };
		}
	}

	// Auth
	async register(email: string, password: string, name: string) {
		return this.request<AuthResponse>('/auth/register', {
			method: 'POST',
			body: JSON.stringify({ email, password, name })
		});
	}

	async login(email: string, password: string) {
		return this.request<AuthResponse>('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password })
		});
	}

	async logout() {
		const result = await this.request('/auth/logout', { method: 'POST' });
		this.setToken(null);
		localStorage.removeItem('refreshToken');
		return result;
	}

	async getMe() {
		return this.request<User>('/auth/me');
	}

	// Folders
	async getRootFolder() {
		return this.request<Folder>('/folders/root');
	}

	async getFolderContents(folderId: string) {
		return this.request<FolderContents>(`/folders/${folderId}/contents`);
	}

	async createFolder(name: string, parentId?: string) {
		return this.request<Folder>('/folders', {
			method: 'POST',
			body: JSON.stringify({ name, parentID: parentId })
		});
	}

	async deleteFolder(folderId: string) {
		return this.request(`/folders/${folderId}`, { method: 'DELETE' });
	}

	async getFolderTree() {
		return this.request<FolderTreeNode[]>('/folders/tree');
	}

	// Files
	async getFiles(folderId?: string) {
		const params = folderId ? `?folderID=${folderId}` : '';
		return this.request<{ items: CloudFile[]; metadata: PageMetadata }>(`/files${params}`);
	}

	async uploadFile(file: File, folderId?: string) {
		const formData = new FormData();
		formData.append('file', file);
		if (folderId) {
			formData.append('folderID', folderId);
		}

		const token = this.getToken();
		const headers: HeadersInit = {};
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		try {
			const response = await fetch(`${API_BASE}/files`, {
				method: 'POST',
				headers,
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return { error: errorData.reason || `Error: ${response.status}` };
			}

			const data = await response.json();
			return { data };
		} catch (err) {
			return { error: 'Upload failed' };
		}
	}

	async downloadFile(fileId: string) {
		const token = this.getToken();
		const response = await fetch(`${API_BASE}/files/${fileId}/download`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		});
		return response;
	}

	async deleteFile(fileId: string) {
		return this.request(`/files/${fileId}`, { method: 'DELETE' });
	}

	// Shares
	async createShare(
		fileId?: string,
		folderId?: string,
		options: {
			permission?: string;
			password?: string;
			expiresAt?: string;
			maxDownloads?: number;
		} = {}
	) {
		return this.request<Share>('/shares', {
			method: 'POST',
			body: JSON.stringify({
				fileId: fileId,
				folderId: folderId,
				permission: options.permission || 'download',
				password: options.password,
				expiresAt: options.expiresAt,
				maxDownloads: options.maxDownloads
			})
		});
	}

	async updateShare(
		shareId: string,
		options: {
			password?: string;
			expiresAt?: string;
			maxDownloads?: number;
			isActive?: boolean;
		}
	) {
		return this.request<Share>(`/shares/${shareId}`, {
			method: 'PUT',
			body: JSON.stringify(options)
		});
	}

	async getShares() {
		return this.request<Share[]>('/shares');
	}

	async getSharesForFile(fileId: string) {
		return this.request<Share[]>(`/shares?fileID=${fileId}`);
	}

	async deleteShare(shareId: string) {
		return this.request(`/shares/${shareId}`, { method: 'DELETE' });
	}

	async getRecentFiles() {
		return this.request<{ items: CloudFile[]; metadata: PageMetadata }>('/files?sort=updatedAt&order=desc&limit=50');
	}

	async getFavorites() {
		return this.request<{ items: CloudFile[]; metadata: PageMetadata }>('/files?favorite=true');
	}

	async toggleFavorite(fileId: string, isFavorite: boolean) {
		return this.request(`/files/${fileId}`, {
			method: 'PATCH',
			body: JSON.stringify({ isFavorite })
		});
	}

	// Trash Operations
	async getTrash() {
		return this.request<CloudFile[]>('/files/trash');
	}

	async restoreFile(fileId: string) {
		return this.request<CloudFile>(`/files/${fileId}/restore`, { method: 'POST' });
	}

	async permanentDeleteFile(fileId: string) {
		return this.request(`/files/${fileId}/permanent`, { method: 'DELETE' });
	}

	// Favorites
	async getFavoritesList() {
		return this.request<{ files: CloudFile[]; folders: Folder[] }>('/favorites');
	}

	async addFileToFavorites(fileId: string) {
		return this.request<CloudFile>(`/favorites/files/${fileId}`, { method: 'POST' });
	}

	async removeFileFromFavorites(fileId: string) {
		return this.request<CloudFile>(`/favorites/files/${fileId}`, { method: 'DELETE' });
	}

	async addFolderToFavorites(folderId: string) {
		return this.request<Folder>(`/favorites/folders/${folderId}`, { method: 'POST' });
	}

	async removeFolderFromFavorites(folderId: string) {
		return this.request<Folder>(`/favorites/folders/${folderId}`, { method: 'DELETE' });
	}

	// Search
	async search(query: string, options: SearchOptions = {}) {
		const params = new URLSearchParams({ q: query });
		if (options.type) params.set('type', options.type);
		if (options.mimeType) params.set('mimeType', options.mimeType);
		if (options.minSize) params.set('minSize', options.minSize.toString());
		if (options.maxSize) params.set('maxSize', options.maxSize.toString());
		if (options.from) params.set('from', options.from);
		if (options.to) params.set('to', options.to);
		if (options.inTrash) params.set('inTrash', 'true');
		return this.request<SearchResult>(`/search?${params}`);
	}

	async searchFiles(query: string) {
		return this.request<{ items: CloudFile[]; metadata: PageMetadata }>(`/search/files?q=${encodeURIComponent(query)}`);
	}

	async getRecentSearchFiles() {
		return this.request<CloudFile[]>('/search/recent');
	}

	// Tags
	async getTags() {
		return this.request<Tag[]>('/tags');
	}

	async createTag(name: string, color: string) {
		return this.request<Tag>('/tags', {
			method: 'POST',
			body: JSON.stringify({ name, color })
		});
	}

	async updateTag(tagId: string, name: string, color: string) {
		return this.request<Tag>(`/tags/${tagId}`, {
			method: 'PUT',
			body: JSON.stringify({ name, color })
		});
	}

	async deleteTag(tagId: string) {
		return this.request(`/tags/${tagId}`, { method: 'DELETE' });
	}

	async getFilesWithTag(tagId: string) {
		return this.request<CloudFile[]>(`/tags/${tagId}/files`);
	}

	async addTagToFile(fileId: string, tagId: string) {
		return this.request(`/files/${fileId}/tags/${tagId}`, { method: 'POST' });
	}

	async removeTagFromFile(fileId: string, tagId: string) {
		return this.request(`/files/${fileId}/tags/${tagId}`, { method: 'DELETE' });
	}

	async getFileTags(fileId: string) {
		return this.request<Tag[]>(`/files/${fileId}/tags`);
	}

	// Versions
	async getFileVersions(fileId: string) {
		return this.request<FileVersion[]>(`/files/${fileId}/versions`);
	}

	async downloadVersion(fileId: string, versionId: string) {
		const token = this.getToken();
		const response = await fetch(`${API_BASE}/files/${fileId}/versions/${versionId}/download`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		});
		return response;
	}

	async restoreVersion(fileId: string, versionId: string) {
		return this.request<CloudFile>(`/files/${fileId}/versions/${versionId}/restore`, { method: 'POST' });
	}

	async deleteVersion(fileId: string, versionId: string) {
		return this.request(`/files/${fileId}/versions/${versionId}`, { method: 'DELETE' });
	}

	// Comments
	async getComments(fileId: string) {
		return this.request<Comment[]>(`/files/${fileId}/comments`);
	}

	async addComment(fileId: string, content: string) {
		return this.request<Comment>(`/files/${fileId}/comments`, {
			method: 'POST',
			body: JSON.stringify({ content })
		});
	}

	async updateComment(fileId: string, commentId: string, content: string) {
		return this.request<Comment>(`/files/${fileId}/comments/${commentId}`, {
			method: 'PUT',
			body: JSON.stringify({ content })
		});
	}

	async deleteComment(fileId: string, commentId: string) {
		return this.request(`/files/${fileId}/comments/${commentId}`, { method: 'DELETE' });
	}

	async resolveComment(fileId: string, commentId: string) {
		return this.request<Comment>(`/files/${fileId}/comments/${commentId}/resolve`, { method: 'POST' });
	}

	async replyToComment(fileId: string, commentId: string, content: string) {
		return this.request<Comment>(`/files/${fileId}/comments/${commentId}/reply`, {
			method: 'POST',
			body: JSON.stringify({ content })
		});
	}

	// Activity
	async getActivity(options: ActivityOptions = {}) {
		const params = new URLSearchParams();
		if (options.action) params.set('action', options.action);
		if (options.resourceType) params.set('resourceType', options.resourceType);
		if (options.from) params.set('from', options.from);
		if (options.to) params.set('to', options.to);
		if (options.page) params.set('page', options.page.toString());
		if (options.perPage) params.set('perPage', options.perPage.toString());
		const queryString = params.toString();
		return this.request<{ items: ActivityLog[]; metadata: PageMetadata }>(`/activity${queryString ? `?${queryString}` : ''}`);
	}

	async getResourceActivity(type: string, id: string) {
		return this.request<ActivityLog[]>(`/activity/resource/${type}/${id}`);
	}

	// 2FA
	async get2FAStatus() {
		return this.request<TwoFactorStatus>('/2fa/status');
	}

	async setup2FA() {
		return this.request<TwoFactorSetup>('/2fa/setup', { method: 'POST' });
	}

	async verify2FA(code: string) {
		return this.request<TwoFactorVerifyResult>('/2fa/verify', {
			method: 'POST',
			body: JSON.stringify({ code })
		});
	}

	async disable2FA(code: string, password: string) {
		return this.request('/2fa/disable', {
			method: 'POST',
			body: JSON.stringify({ code, password })
		});
	}

	async getBackupCodesCount() {
		return this.request<{ remainingCount: number }>('/2fa/backup-codes');
	}

	async regenerateBackupCodes(code: string) {
		return this.request<{ backupCodes: string[] }>('/2fa/regenerate-backup-codes', {
			method: 'POST',
			body: JSON.stringify({ code })
		});
	}

	// Streaming
	async streamFile(fileId: string) {
		const token = this.getToken();
		return fetch(`${API_BASE}/stream/${fileId}`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		});
	}

	async getFileThumbnail(fileId: string) {
		const token = this.getToken();
		return fetch(`${API_BASE}/stream/${fileId}/thumbnail`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		});
	}

	async getFilePreview(fileId: string) {
		const token = this.getToken();
		return fetch(`${API_BASE}/stream/${fileId}/preview`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		});
	}

	// Dashboard Stats
	async getDashboardStats() {
		const [filesRes, favRes, trashRes, sharesRes, activityRes] = await Promise.all([
			this.request<{ items: CloudFile[]; metadata: PageMetadata }>('/files?limit=5&sort=updatedAt&order=desc'),
			this.getFavoritesList(),
			this.getTrash(),
			this.getShares(),
			this.getActivity({ perPage: 10 })
		]);

		return {
			recentFiles: filesRes.data?.items || [],
			totalFiles: filesRes.data?.metadata.total || 0,
			favorites: favRes.data || { files: [], folders: [] },
			trash: trashRes.data || [],
			shares: sharesRes.data || [],
			recentActivity: activityRes.data?.items || []
		};
	}
}

// Types
export interface User {
	id: string;
	email: string;
	name: string;
	storageQuota: number;
	storageUsed: number;
	isAdmin: boolean;
	createdAt: string;
}

export interface AuthResponse {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
	user: User;
}

export interface Folder {
	id: string;
	name: string;
	path: string;
	parentID?: string;
	isRoot: boolean;
	childCount?: number;
	fileCount?: number;
	isFavorite?: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CloudFile {
	id: string;
	name: string;
	mimeType: string;
	size: number;
	path: string;
	folderID?: string;
	version: number;
	etag: string;
	isFavorite?: boolean;
	deletedAt?: string;
	tags?: Tag[];
	createdAt: string;
	updatedAt: string;
}

export interface FolderContents {
	folder: Folder;
	folders: Folder[];
	files: CloudFile[];
}

export interface FolderTreeNode {
	id: string;
	name: string;
	path: string;
	children: FolderTreeNode[];
}

export interface Share {
	id: string;
	token: string;
	fileID?: string;
	folderID?: string;
	permission: string;
	hasPassword: boolean;
	expiresAt?: string;
	maxDownloads?: number;
	downloadCount: number;
	isActive: boolean;
	createdAt: string;
	shareURL: string;
}

export interface PageMetadata {
	page: number;
	per: number;
	total: number;
}

export interface SearchOptions {
	type?: string;
	mimeType?: string;
	minSize?: number;
	maxSize?: number;
	from?: string;
	to?: string;
	inTrash?: boolean;
}

export interface SearchResult {
	files: CloudFile[];
	folders: Folder[];
	totalFiles: number;
	totalFolders: number;
}

export interface Tag {
	id: string;
	name: string;
	color: string;
	fileCount?: number;
	createdAt: string;
}

export interface FileVersion {
	id: string;
	fileID: string;
	versionNumber: number;
	size: number;
	checksum: string;
	changeSummary?: string;
	createdByID: string;
	createdAt: string;
}

export interface Comment {
	id: string;
	userID: string;
	userName: string;
	fileID: string;
	content: string;
	isResolved: boolean;
	parentID?: string;
	replies?: Comment[];
	createdAt: string;
	updatedAt: string;
}

export interface ActivityOptions {
	action?: string;
	resourceType?: string;
	from?: string;
	to?: string;
	page?: number;
	perPage?: number;
}

export interface ActivityLog {
	id: string;
	userID: string;
	action: string;
	resourceType: string;
	resourceID: string;
	resourceName: string;
	details?: string;
	ipAddress: string;
	userAgent?: string;
	createdAt: string;
}

export interface TwoFactorStatus {
	isEnabled: boolean;
	isVerified: boolean;
}

export interface TwoFactorSetup {
	secret: string;
	otpauthURL: string;
	qrCodeURL: string;
}

export interface TwoFactorVerifyResult {
	success: boolean;
	backupCodes?: string[];
}

export const api = new ApiClient();
