<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { blocksStore, type Block } from '$lib/stores/blocks.svelte';
	import { chatStore, type ChatMessage } from '$lib/stores/chat.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { setInReportContext } from '$lib/stores/persistence';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import ReportEditor from '$lib/components/ReportEditor.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import TemplatePicker from '$lib/components/TemplatePicker.svelte';
	import DatasetSwapPill from '$lib/components/DatasetSwapPill.svelte';
	import { api, ApiError } from '$lib/api';

	let { data } = $props();

	let saving = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let errMsg = $state<string | null>(null);
	let nameDraft = $state(data.report.name);
	let currentDatasetRef = $state<string | null>(data.report.datasetRef);

	const canEdit = $derived(data.project.role === 'owner' || data.project.role === 'editor');

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	const DEBOUNCE_MS = 800;

	// Snapshot helpers — produce plain JSON-safe shapes identical to what
	// the stores produce for localStorage autosave.
	function blocksSnapshot(): { v: 1; blocks: Block[] } {
		return {
			v: 1,
			blocks: blocksStore.list.map((b) => ({
				id: b.id,
				type: b.type,
				title: b.title,
				config: JSON.parse(JSON.stringify(b.config ?? {})) as Record<string, unknown>,
				createdAt: b.createdAt
			}))
		};
	}
	function chatSnapshot(): { v: 1; messages: ChatMessage[] } {
		return {
			v: 1,
			messages: chatStore.messages.map((m) => ({
				id: m.id,
				role: m.role,
				text: m.text,
				ts: m.ts,
				toolCalled: m.toolCalled,
				error: m.error
			}))
		};
	}

	async function persist(patch: {
		name?: string;
		blocks?: unknown;
		chat?: unknown;
		datasetRef?: string | null;
	}) {
		saving = 'saving';
		errMsg = null;
		try {
			await api(`/api/reports/${data.report.id}`, { method: 'PATCH', body: patch });
			saving = 'saved';
		} catch (ex) {
			saving = 'error';
			errMsg = ex instanceof ApiError ? ex.message : String(ex);
		}
	}

	function scheduleAutosave() {
		if (!canEdit) return;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			saveTimer = null;
			void persist({ blocks: blocksSnapshot(), chat: chatSnapshot() });
		}, DEBOUNCE_MS);
	}

	async function renameReport() {
		const trimmed = nameDraft.trim();
		if (!trimmed || trimmed === data.report.name) return;
		await persist({ name: trimmed });
	}

	async function onDatasetSwap(ref: string | null) {
		currentDatasetRef = ref;
		await persist({ datasetRef: ref });
	}

	let hydrated = false;

	onMount(() => {
		// Enter report context — suppress legacy localStorage autosave.
		setInReportContext(true);

		// Hydrate stores from the loaded report data.
		const b = data.report.blocks as { blocks?: Block[] } | undefined;
		const c = data.report.chat as { messages?: ChatMessage[] } | undefined;
		if (b && Array.isArray(b.blocks)) blocksStore.replaceAll(b.blocks);
		else blocksStore.replaceAll([]);
		if (c && Array.isArray(c.messages)) chatStore.replaceAll(c.messages);

		// Hydrate the dataset if the report references a preset.
		if (
			data.report.datasetRef &&
			!data.report.datasetRef.startsWith('upload:') &&
			data.report.datasetRef.length > 0
		) {
			void datasetStore.load(data.report.datasetRef);
		} else {
			datasetStore.clear();
		}

		hydrated = true;

		// Track changes and autosave. Read every field we care about so Svelte's
		// reactivity tracks deep updates from block config edits.
		$effect.root(() => {
			$effect(() => {
				if (!hydrated) return;
				// eslint-disable-next-line @typescript-eslint/no-unused-expressions
				blocksStore.list.map((b) => ({ id: b.id, config: { ...b.config }, title: b.title }));
				scheduleAutosave();
			});
			$effect(() => {
				if (!hydrated) return;
				// eslint-disable-next-line @typescript-eslint/no-unused-expressions
				chatStore.messages.length;
				scheduleAutosave();
			});
			// Mirror dataset-picker selections into the report's top-level
			// datasetRef so the preset id survives reload via the server.
			$effect(() => {
				if (!hydrated) return;
				const cur = datasetStore.current;
				const ref = cur ? (cur.id === 'upload' ? `upload:${cur.name}` : cur.id) : null;
				if (ref === currentDatasetRef) return;
				currentDatasetRef = ref;
				void persist({ datasetRef: ref });
			});
			return () => {};
		});
	});

	onDestroy(() => {
		setInReportContext(false);
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
			// Best-effort flush on navigation.
			void api(`/api/reports/${data.report.id}`, {
				method: 'PATCH',
				body: { blocks: blocksSnapshot(), chat: chatSnapshot() }
			}).catch(() => {});
		}
	});
</script>

<AppHeader subtitle={data.project.name}>
	{#snippet rightSlot()}
		<span class="hidden text-[11px] sm:inline" style="color: var(--text-muted);">
			{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Save failed' : ''}
		</span>
		<TemplatePicker />
		<ExportMenu />
	{/snippet}
</AppHeader>

<div
	class="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2"
	style="background: var(--surface-raised); border-color: var(--border-default);"
>
	<div class="flex min-w-0 items-center gap-3">
		{#if canEdit}
			<input
				type="text"
				bind:value={nameDraft}
				onblur={renameReport}
				class="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm"
				style="border-color: var(--border-default); color: var(--text-primary); font-family: var(--font-serif);"
			/>
		{:else}
			<span class="text-sm" style="color: var(--text-primary); font-family: var(--font-serif);"
				>{data.report.name}</span
			>
		{/if}
		<DatasetSwapPill datasetRef={currentDatasetRef} onChange={onDatasetSwap} />
	</div>
	{#if errMsg}
		<span class="text-[11px]" style="color: #e57373;">{errMsg}</span>
	{/if}
</div>

<ReportEditor consumeShareState={false} />
