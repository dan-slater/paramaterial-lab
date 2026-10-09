<script lang="ts">
	import { sessionStore } from '$lib/stores/session.svelte';
	import { ApiError } from '$lib/api';

	let {
		open = $bindable(false),
		onSuccess
	}: { open?: boolean; onSuccess?: () => void } = $props();

	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let busy = $state(false);
	let err = $state<string | null>(null);

	function reset() {
		email = '';
		password = '';
		displayName = '';
		err = null;
	}

	async function submit(e: Event) {
		e.preventDefault();
		if (busy) return;
		err = null;
		busy = true;
		try {
			if (mode === 'login') {
				await sessionStore.login(email, password);
			} else {
				await sessionStore.register(email, password, displayName);
			}
			open = false;
			reset();
			onSuccess?.();
		} catch (ex) {
			err = ex instanceof ApiError ? ex.message : String(ex);
		} finally {
			busy = false;
		}
	}

	function close() {
		open = false;
		reset();
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button
		type="button"
		aria-label="Close"
		onclick={close}
		class="fixed inset-0 z-40 cursor-default"
		style="background: rgb(0 0 0 / 0.55);"
	></button>
	<div
		role="dialog"
		aria-modal="true"
		class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-xl"
		style="background: var(--surface-card); border-color: var(--border-strong); box-shadow: var(--shadow-md);"
	>
		<p class="caption-eyebrow">paramaterial</p>
		<h2
			class="mt-1 text-xl"
			style="font-family: var(--font-serif); letter-spacing: -0.01em; color: var(--text-primary);"
		>
			{mode === 'login' ? 'Sign in' : 'Create an account'}
		</h2>
		<p class="caption-note mt-1 text-xs" style="color: var(--text-muted);">
			An account only saves projects. The presets, CSV import and chat work without one.
		</p>

		<form class="mt-4 flex flex-col gap-3" onsubmit={submit}>
			{#if mode === 'register'}
				<label class="flex flex-col gap-1 text-xs" style="color: var(--text-secondary);">
					<span class="caption-eyebrow">Display name</span>
					<input
						type="text"
						bind:value={displayName}
						required
						autocomplete="name"
						class="rounded-md border px-3 py-2 text-sm"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					/>
				</label>
			{/if}
			<label class="flex flex-col gap-1 text-xs" style="color: var(--text-secondary);">
				<span class="caption-eyebrow">Email</span>
				<input
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					class="rounded-md border px-3 py-2 text-sm"
					style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs" style="color: var(--text-secondary);">
				<span class="caption-eyebrow">Password</span>
				<input
					type="password"
					bind:value={password}
					required
					minlength={mode === 'register' ? 10 : undefined}
					maxlength={256}
					autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					class="rounded-md border px-3 py-2 text-sm"
					style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
				/>
			</label>

			{#if err}
				<p class="text-xs" style="color: #e57373;">{err}</p>
			{/if}

			<button
				type="submit"
				disabled={busy}
				class="mt-1 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
				style="background: var(--accent-ui); color: var(--surface-page); border-color: var(--accent-ui-strong);"
			>
				{busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
			</button>
		</form>

		<div class="mt-4 flex items-center justify-between text-xs" style="color: var(--text-muted);">
			{#if sessionStore.allowSignup || mode === 'register'}
				<button
					type="button"
					onclick={() => {
						mode = mode === 'login' ? 'register' : 'login';
						err = null;
					}}
					class="underline-offset-2 hover:underline"
				>
					{mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
				</button>
			{:else}
				<span>Registration is closed.</span>
			{/if}
			<button type="button" onclick={close} class="underline-offset-2 hover:underline">
				Close
			</button>
		</div>
	</div>
{/if}
