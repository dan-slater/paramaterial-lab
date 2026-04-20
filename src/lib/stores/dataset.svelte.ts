import type { Dataset } from '$lib/datasets';

interface DatasetState {
	current: Dataset | null;
	loading: boolean;
	error: string | null;
}

const state = $state<DatasetState>({
	current: null,
	loading: false,
	error: null
});

export const datasetStore = {
	get current() {
		return state.current;
	},
	get loading() {
		return state.loading;
	},
	get error() {
		return state.error;
	},
	set(ds: Dataset) {
		state.current = ds;
		state.error = null;
	},
	clear() {
		state.current = null;
		state.error = null;
	},
	async load(id: string, fetchFn: typeof fetch = fetch) {
		state.loading = true;
		state.error = null;
		try {
			const res = await fetchFn(`/data/${id}.json`);
			if (!res.ok) throw new Error(`Failed to load ${id}: ${res.status}`);
			state.current = await res.json();
		} catch (e) {
			state.error = e instanceof Error ? e.message : String(e);
		} finally {
			state.loading = false;
		}
	}
};
