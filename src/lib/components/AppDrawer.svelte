<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { sessionStore } from '$lib/stores/session.svelte';
	import { api, ApiError } from '$lib/api';

	interface ProjectListing {
		id: string;
		name: string;
		description: string | null;
		role: 'owner' | 'editor' | 'viewer';
		reportCount: number;
		updatedAt: number;
	}

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let projects = $state<ProjectListing[]>([]);
	let loading = $state(false);
	let err = $state<string | null>(null);
	let newName = $state('');
	let creating = $state(false);

	async function refresh() {
		if (!sessionStore.user) {
			projects = [];
			return;
		}
		loading = true;
		err = null;
		try {
			const res = await api<{ projects: ProjectListing[] }>('/api/projects');
			projects = res.projects;
		} catch (ex) {
			err = ex instanceof ApiError ? ex.message : String(ex);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		// Re-fetch whenever the drawer is opened or the user changes.
		if (open && sessionStore.user) {
			void refresh();
		}
	});

	async function createProject(e: Event) {
		e.preventDefault();
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		err = null;
		try {
			const res = await api<{ project: { id: string } }>('/api/projects', {
				body: { name }
			});
			newName = '';
			open = false;
			void goto(`/projects/${res.project.id}`);
		} catch (ex) {
			err = ex instanceof ApiError ? ex.message : String(ex);
		} finally {
			creating = false;
		}
	}

	async function signOut() {
		try {
			await sessionStore.logout();
		} catch {
			/* ignore */
		}
		open = false;
		void goto('/');
	}

	function openProject(id: string) {
		open = false;
		void goto(`/projects/${id}`);
	}

	onMount(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape' && open) open = false;
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if open}
	<button
		type="button"
		aria-label="Close drawer"
		onclick={() => (open = false)}
		class="fixed inset-0 z-40 cursor-default"
		style="background: rgb(0 0 0 / 0.35);"
	></button>
	<aside
		class="fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r"
		style="background: var(--surface-raised); border-color: var(--border-default); box-shadow: var(--shadow-md);"
	>
		<div
			class="flex items-center justify-between border-b px-4 py-3"
			style="border-color: var(--border-default);"
		>
			<span
				class="text-base font-semibold"
				style="font-family: var(--font-serif); letter-spacing: -0.01em; color: var(--text-primary);"
				>paramaterial</span
			>
			<button
				type="button"
				onclick={() => (open = false)}
				class="rounded-md border px-2 py-1 text-xs"
				style="border-color: var(--border-default); color: var(--text-secondary);"
				aria-label="Close"
			>
				Close
			</button>
		</div>

		{#if sessionStore.user}
			<div
				class="flex items-start justify-between gap-3 border-b px-4 py-3"
				style="border-color: var(--border-default);"
			>
				<div class="min-w-0">
					<p
						class="truncate text-sm font-medium"
						style="color: var(--text-primary); font-family: var(--font-serif);"
					>
						{sessionStore.user.displayName}
					</p>
					<p class="truncate text-xs" style="color: var(--text-muted);">
						{sessionStore.user.email}
					</p>
				</div>
				<button
					type="button"
					onclick={signOut}
					class="shrink-0 rounded-md border px-2 py-1 text-xs"
					style="border-color: var(--border-default); color: var(--text-secondary);"
				>
					Sign out
				</button>
			</div>

			<div class="flex-1 overflow-y-auto px-4 py-3">
				<p class="caption-eyebrow">Projects</p>
				{#if loading}
					<p class="mt-2 text-xs" style="color: var(--text-muted);">Loading…</p>
				{:else if err}
					<p class="mt-2 text-xs" style="color: #e57373;">{err}</p>
				{:else if projects.length === 0}
					<p class="mt-2 text-xs italic" style="color: var(--text-muted); font-family: var(--font-serif);">
						No projects yet — create one below.
					</p>
				{:else}
					<ul class="mt-2 flex flex-col gap-1">
						{#each projects as p (p.id)}
							<li>
								<button
									type="button"
									onclick={() => openProject(p.id)}
									class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors"
									style="background: var(--surface-card); border-color: var(--border-default);"
								>
									<span class="min-w-0">
										<span
											class="block truncate text-sm"
											style="color: var(--text-primary); font-family: var(--font-serif);"
											>{p.name}</span
										>
										<span class="block text-xs" style="color: var(--text-muted);">
											{p.reportCount} report{p.reportCount === 1 ? '' : 's'} · {p.role}
										</span>
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<form class="mt-4 flex flex-col gap-2" onsubmit={createProject}>
					<p class="caption-eyebrow">New project</p>
					<input
						type="text"
						bind:value={newName}
						placeholder="Project name"
						class="rounded-md border px-3 py-2 text-sm"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					/>
					<button
						type="submit"
						disabled={creating || !newName.trim()}
						class="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
						style="background: var(--accent-ui); color: var(--surface-page); border-color: var(--accent-ui-strong);"
					>
						{creating ? '…' : 'Create'}
					</button>
				</form>
			</div>

			<div class="border-t px-4 py-3" style="border-color: var(--border-default);">
				<p class="caption-eyebrow">Settings</p>
				<p class="mt-1 text-xs italic" style="color: var(--text-muted); font-family: var(--font-serif);">
					(Nothing here yet.)
				</p>
			</div>
		{:else}
			<div class="flex-1 px-4 py-4 text-sm" style="color: var(--text-secondary);">
				Sign in to create and share projects.
			</div>
		{/if}
	</aside>
{/if}
