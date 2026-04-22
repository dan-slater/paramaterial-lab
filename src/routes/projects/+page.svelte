<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { api, ApiError } from '$lib/api';

	let { data } = $props();

	let creating = $state(false);
	let newName = $state('');
	let newDesc = $state('');
	let err = $state<string | null>(null);
	let showForm = $state(false);

	async function createProject(e: Event) {
		e.preventDefault();
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		err = null;
		try {
			const res = await api<{ project: { id: string } }>('/api/projects', {
				body: { name, description: newDesc.trim() || undefined }
			});
			newName = '';
			newDesc = '';
			showForm = false;
			await invalidateAll();
			void goto(`/projects/${res.project.id}`);
		} catch (ex) {
			err = ex instanceof ApiError ? ex.message : String(ex);
		} finally {
			creating = false;
		}
	}

	function fmtDate(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

<AppHeader subtitle="Projects" />

<div class="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
	<div class="mx-auto max-w-5xl">
		<div class="flex items-end justify-between gap-4">
			<div>
				<p class="caption-eyebrow">Your library</p>
				<h1
					class="mt-1 text-3xl"
					style="font-family: var(--font-serif); letter-spacing: -0.015em; color: var(--text-primary);"
				>
					Projects
				</h1>
			</div>
			<button
				type="button"
				onclick={() => (showForm = !showForm)}
				class="rounded-md border px-3 py-2 text-sm"
				style="background: var(--accent-ui); color: var(--surface-page); border-color: var(--accent-ui-strong);"
			>
				{showForm ? 'Cancel' : 'New project'}
			</button>
		</div>

		{#if showForm}
			<form
				class="mt-6 flex flex-col gap-3 rounded-lg border p-4"
				style="background: var(--surface-card); border-color: var(--border-default);"
				onsubmit={createProject}
			>
				<label class="flex flex-col gap-1 text-xs">
					<span class="caption-eyebrow">Name</span>
					<input
						type="text"
						bind:value={newName}
						required
						class="rounded-md border px-3 py-2 text-sm"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					/>
				</label>
				<label class="flex flex-col gap-1 text-xs">
					<span class="caption-eyebrow">Description (optional)</span>
					<textarea
						bind:value={newDesc}
						rows="2"
						class="rounded-md border px-3 py-2 text-sm"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					></textarea>
				</label>
				{#if err}<p class="text-xs" style="color: #e57373;">{err}</p>{/if}
				<div>
					<button
						type="submit"
						disabled={creating || !newName.trim()}
						class="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
						style="background: var(--accent-ui); color: var(--surface-page); border-color: var(--accent-ui-strong);"
					>
						{creating ? '…' : 'Create'}
					</button>
				</div>
			</form>
		{/if}

		<hr
			class="mt-6 border-0"
			style="height: 1px; background: linear-gradient(to right, var(--border-strong), transparent);"
		/>

		{#if data.projects.length === 0}
			<p
				class="mt-8 text-sm italic"
				style="color: var(--text-muted); font-family: var(--font-serif);"
			>
				No projects yet. Start a new one above.
			</p>
		{:else}
			<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.projects as p (p.id)}
					<a
						href={`/projects/${p.id}`}
						class="block rounded-lg border p-4 transition-colors"
						style="background: var(--surface-card); border-color: var(--border-default); box-shadow: var(--shadow-card);"
					>
						<p class="caption-eyebrow">{p.role}</p>
						<h2
							class="mt-1 text-lg"
							style="font-family: var(--font-serif); letter-spacing: -0.01em; color: var(--text-primary);"
						>
							{p.name}
						</h2>
						{#if p.description}
							<p class="mt-1 text-xs" style="color: var(--text-secondary);">{p.description}</p>
						{/if}
						<p class="mt-3 text-[11px]" style="color: var(--text-muted);">
							{p.reportCount} report{p.reportCount === 1 ? '' : 's'} · updated {fmtDate(p.updatedAt)}
						</p>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
