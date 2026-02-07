import { writable } from 'svelte/store';
import { api, type User } from '$lib/api/client';

interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		isAuthenticated: false,
		isLoading: true
	});

	return {
		subscribe,

		async init() {
			const token = api.getToken();
			if (token) {
				const { data, error } = await api.getMe();
				if (data && !error) {
					set({ user: data, isAuthenticated: true, isLoading: false });
					return;
				}
			}
			set({ user: null, isAuthenticated: false, isLoading: false });
		},

		async login(email: string, password: string) {
			const { data, error } = await api.login(email, password);
			if (data && !error) {
				api.setToken(data.accessToken);
				localStorage.setItem('refreshToken', data.refreshToken);
				set({ user: data.user, isAuthenticated: true, isLoading: false });
				return { success: true };
			}
			return { success: false, error };
		},

		async register(email: string, password: string, name: string) {
			const { data, error } = await api.register(email, password, name);
			if (data && !error) {
				api.setToken(data.accessToken);
				localStorage.setItem('refreshToken', data.refreshToken);
				set({ user: data.user, isAuthenticated: true, isLoading: false });
				return { success: true };
			}
			return { success: false, error };
		},

		async logout() {
			await api.logout();
			set({ user: null, isAuthenticated: false, isLoading: false });
		}
	};
}

export const auth = createAuthStore();
