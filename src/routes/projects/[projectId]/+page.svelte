<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { api, ApiError } from '$lib/api';

	let { data } = $props();

	let creatingReport = $state(false);
	let reportName = $state('');
	let showNewReport = $state(false);

	let showInvite = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state<'viewer' | 'editor' | 'owner'>('editor');
	let inviteBusy = $state(false);
	let err = $state<string | null>(null);

	const canInvite = $derived(data.project.role === 'owner');
	const canCreate = $derived(data.project.role === 'owner' || data.project.role === 'editor');

	async function createReport(e: Event) {
		e.preventDefault();
		if (creatingReport) return;
		const name = reportName.trim() || 'Untitled report';
		creatingReport = true;
		err = null;
		try {
			const res = await api<{ report: { id: string } }>(
				`/api/projects/${data.project.id}/reports`,
				{ body: { name } }
			);
			reportName = '';
			showNewReport = false;
			void goto(`/projects/${data.project.id}/reports/${res.report.id}`);
		} catch (ex) {
			err = ex instanceof ApiError ? ex.message : String(ex);
		} finally {
			creatingReport = false;
		}
	}

	async function invite(e: Event) {
		e.preventDefault();
		const email = inviteEmail.trim();
		if (!email || inviteBusy) return;
		inviteBusy = true;
		err = null;
		try {
			await api(`/api/projects/${data.project.id}/members`, {
				body: { email, role: inviteRole }
			});
			inviteEmail = '';
			showInvite = false;
			await invalidateAll();
		} catch (ex) {
			err = ex instanceof ApiError ? ex.message : String(ex);
		} finally {
			inviteBusy = false;
		}
	}

	async function removeMember(userId: string) {
		if (!confirm('Remove this member from the project?')) return;
		try {
			await api(`/api/projects/${data.project.id}/members/${userId}`, { method: 'DELETE' });
			await invalidateAll();
		} catch (ex) {
			alert(ex instanceof ApiError ? ex.message : String(ex));
		}
	}

	function fmtDate(ts: number): string {
		return new Date(ts).toLocaleString();
	}
</script>

<AppHeader subtitle={data.project.name} />

<div class="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
	<div class="mx-auto flex max-w-5xl flex-col gap-8">
		<div>
			<p class="caption-eyebrow">Project · {data.project.role}</p>
			<h1
				class="mt-1 text-3xl"
				style="font-family: var(--font-serif); letter-spacing: -0.015em; color: var(--text-primary);"
			>
				{data.project.name}
			</h1>
			{#if data.project.description}
				<p
					class="mt-2 text-sm italic"
					style="color: var(--text-secondary); font-family: var(--font-serif);"
				>
					{data.project.description}
				</p>
			{/if}
		</div>

		<section>
			<div class="flex items-center justify-between">
				<p class="caption-eyebrow">Reports</p>
				{#if canCreate}
					<button
						type="button"
						onclick={() => (showNewReport = !showNewReport)}
						class="rounded-md border px-3 py-1.5 text-xs"
						style="background: var(--accent-ui); color: var(--surface-page); border-color: var(--accent-ui-strong);"
					>
						{showNewReport ? 'Cancel' : 'New report'}
					</button>
				{/if}
			</div>

			{#if showNewReport}
				<form
					class="mt-3 flex gap-2 rounded-md border p-3"
					style="background: var(--surface-card); border-color: var(--border-default);"
					onsubmit={createReport}
				>
					<input
						type="text"
						bind:value={reportName}
						placeholder="Report name"
						class="flex-1 rounded-md border px-3 py-2 text-sm"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					/>
					<button
						type="submit"
						disabled={creatingReport}
						class="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
						style="background: var(--accent-ui); color: var(--surface-page); border-color: var(--accent-ui-strong);"
					>
						{creatingReport ? '…' : 'Create'}
					</button>
				</form>
			{/if}

			{#if data.reports.length === 0}
				<p
					class="mt-3 text-sm italic"
					style="color: var(--text-muted); font-family: var(--font-serif);"
				>
					No reports yet.
				</p>
			{:else}
				<ul class="mt-3 flex flex-col gap-2">
					{#each data.reports as r (r.id)}
						<li
							class="flex items-center justify-between gap-3 rounded-md border p-3"
							style="background: var(--surface-card); border-color: var(--border-default);"
						>
							<div class="min-w-0">
								<p
									class="truncate text-base"
									style="font-family: var(--font-serif); color: var(--text-primary);"
								>
									{r.name}
								</p>
								<p class="text-[11px]" style="color: var(--text-muted);">
									{r.datasetRef ? `dataset: ${r.datasetRef}` : 'no dataset'} · updated {fmtDate(r.updatedAt)}
								</p>
							</div>
							<a
								href={`/projects/${data.project.id}/reports/${r.id}`}
								class="shrink-0 rounded-md border px-3 py-1.5 text-xs"
								style="border-color: var(--border-default); color: var(--text-secondary);"
								>Open</a
							>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<div class="flex items-center justify-between">
				<p class="caption-eyebrow">Members</p>
				{#if canInvite}
					<button
						type="button"
						onclick={() => (showInvite = !showInvite)}
						class="rounded-md border px-3 py-1.5 text-xs"
						style="border-color: var(--border-default); color: var(--text-secondary);"
					>
						{showInvite ? 'Cancel' : 'Invite member'}
					</button>
				{/if}
			</div>

			{#if showInvite}
				<form
					class="mt-3 flex gap-2 rounded-md border p-3"
					style="background: var(--surface-card); border-color: var(--border-default);"
					onsubmit={invite}
				>
					<input
						type="email"
						bind:value={inviteEmail}
						placeholder="email@example.com"
						required
						class="flex-1 rounded-md border px-3 py-2 text-sm"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					/>
					<select
						bind:value={inviteRole}
						class="rounded-md border px-3 py-2 text-sm"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					>
						<option value="viewer">viewer</option>
						<option value="editor">editor</option>
						<option value="owner">owner</option>
					</select>
					<button
						type="submit"
						disabled={inviteBusy}
						class="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
						style="background: var(--accent-ui); color: var(--surface-page); border-color: var(--accent-ui-strong);"
					>
						{inviteBusy ? '…' : 'Add'}
					</button>
				</form>
			{/if}

			{#if err}<p class="mt-2 text-xs" style="color: #e57373;">{err}</p>{/if}

			<ul class="mt-3 flex flex-col gap-2">
				{#each data.members as m (m.userId)}
					<li
						class="flex items-center justify-between gap-3 rounded-md border p-3"
						style="background: var(--surface-card); border-color: var(--border-default);"
					>
						<div class="min-w-0">
							<p
								class="truncate text-sm"
								style="color: var(--text-primary); font-family: var(--font-serif);"
							>
								{m.displayName}
							</p>
							<p class="truncate text-[11px]" style="color: var(--text-muted);">
								{m.email} · {m.role}
							</p>
						</div>
						{#if (canInvite || m.userId === data.project.ownerId) && m.userId !== data.project.ownerId}
							<button
								type="button"
								onclick={() => removeMember(m.userId)}
								class="shrink-0 rounded-md border px-2 py-1 text-[11px]"
								style="border-color: var(--border-default); color: var(--text-secondary);"
								>Remove</button
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	</div>
</div>
