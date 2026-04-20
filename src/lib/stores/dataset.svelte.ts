import type { Dataset } from '$lib/datasets';
import { loadJSON, STORAGE_KEYS } from './persistence';
import { blocksStore } from './blocks.svelte';

interface DatasetState {
	current: Dataset | null;
	loading: boolean;
	error: string | null;
	needsReupload: boolean;
}

const state = $state<DatasetState>({
	current: null,
	loading: false,
	error: null,
	needsReupload: false
});

// Mirror the currently-loaded dataset (preset id or upload flag) into the
// dataset-picker block's config so it survives a reload via localStorage.
function syncPickerConfig(ds: Dataset | null) {
	const picker = blocksStore.list.find((b) => b.type === 'dataset-picker');
	if (!picker) return;
	if (!ds) {
		if (picker.config.id || picker.config.uploaded) {
			blocksStore.update(picker.id, { config: {} });
		}
		return;
	}
	const next: Record<string, unknown> =
		ds.id === 'upload' ? { uploaded: true, name: ds.name } : { id: ds.id };
	blocksStore.update(picker.id, { config: next });
}

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
	get needsReupload() {
		return state.needsReupload;
	},
	set(ds: Dataset) {
		state.current = ds;
		state.error = null;
		state.needsReupload = false;
		syncPickerConfig(ds);
	},
	clear() {
		state.current = null;
		state.error = null;
		state.needsReupload = false;
		syncPickerConfig(null);
	},
	dismissReuploadNotice() {
		state.needsReupload = false;
	},
	async load(id: string, fetchFn: typeof fetch = fetch) {
		state.loading = true;
		state.error = null;
		try {
			const res = await fetchFn(`/data/${id}.json`);
			if (!res.ok) throw new Error(`Failed to load ${id}: ${res.status}`);
			state.current = await res.json();
			state.needsReupload = false;
			syncPickerConfig(state.current);
		} catch (e) {
			state.error = e instanceof Error ? e.message : String(e);
		} finally {
			state.loading = false;
		}
	}
};

// On module init (browser only), rehydrate the previously-loaded preset dataset
// if the saved blocks reference one. If the previous session was an uploaded CSV,
// flag it so the UI can prompt for re-upload (we don't persist raw CSV data).
if (typeof window !== 'undefined' && !state.current) {
	const saved = loadJSON<{ v: 1; blocks: Array<{ type: string; config: Record<string, unknown> }> }>(
		STORAGE_KEYS.blocks
	);
	const picker = saved?.blocks?.find((b) => b.type === 'dataset-picker');
	const presetId = picker?.config?.id;
	const wasUpload = picker?.config?.uploaded === true;
	if (typeof presetId === 'string' && presetId.length > 0) {
		// Fire and forget; UI will render when it completes.
		void datasetStore.load(presetId);
	} else if (wasUpload) {
		state.needsReupload = true;
	}
}
