<script lang="ts">
	import { getApiKey, setApiKey, clearApiKey } from '$lib/claude';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let draft = $state('');
	let showKey = $state(false);
	let hasExisting = $state(false);

	$effect(() => {
		if (open) {
			const existing = getApiKey();
			hasExisting = !!existing;
			// Don't show the full existing key; let the user re-enter or clear.
			draft = '';
			showKey = false;
		}
	});

	function save() {
		const trimmed = draft.trim();
		if (!trimmed) return;
		setApiKey(trimmed);
		hasExisting = true;
		draft = '';
		onClose();
	}

	function clear() {
		clearApiKey();
		hasExisting = false;
		draft = '';
	}

	function onBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
		onclick={onBackdrop}
	>
		<div
			class="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="apikey-title"
		>
			<h2 id="apikey-title" class="text-sm font-semibold tracking-tight text-neutral-100">
				Anthropic API key
			</h2>
			<p class="mt-1 text-xs text-neutral-400">
				Paste your Anthropic API key to enable real Claude-powered chat. Without a key the chat
				falls back to a basic rule-based intent matcher.
			</p>

			<div class="mt-4">
				<label class="text-[11px] uppercase tracking-wider text-neutral-500" for="apikey-input">
					API key
				</label>
				<div class="mt-1 flex gap-2">
					<input
						id="apikey-input"
						bind:value={draft}
						type={showKey ? 'text' : 'password'}
						autocomplete="off"
						spellcheck="false"
						placeholder={hasExisting ? 'Replace existing key…' : 'sk-ant-…'}
						class="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-plasma-500 focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => (showKey = !showKey)}
						class="shrink-0 rounded-md border border-neutral-800 px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
					>
						{showKey ? 'Hide' : 'Show'}
					</button>
				</div>
				{#if hasExisting}
					<p class="mt-1 text-[11px] text-neutral-500">A key is currently saved in this browser.</p>
				{/if}
			</div>

			<div
				class="mt-4 rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-[11px] leading-relaxed text-amber-200"
			>
				<strong>Client-side only.</strong> Your key is stored in this browser's
				<code class="font-mono">localStorage</code> and sent directly to
				<code class="font-mono">api.anthropic.com</code>. It is not proxied through any server we
				run. Anyone with access to this browser profile can read it. Clear it when you're done.
			</div>

			<p class="mt-3 text-[11px] text-neutral-500">
				Need a key?
				<a
					href="https://console.anthropic.com/settings/keys"
					target="_blank"
					rel="noopener noreferrer"
					class="text-plasma-400 underline decoration-dotted hover:text-plasma-300"
				>
					console.anthropic.com/settings/keys
				</a>
			</p>

			<div class="mt-5 flex items-center justify-between">
				<button
					type="button"
					onclick={clear}
					disabled={!hasExisting}
					class="rounded-md border border-neutral-800 px-3 py-1.5 text-[11px] text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Clear saved key
				</button>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={onClose}
						class="rounded-md border border-neutral-800 px-3 py-1.5 text-[11px] text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
					>
						Close
					</button>
					<button
						type="button"
						onclick={save}
						disabled={!draft.trim()}
						class="rounded-md bg-plasma-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-plasma-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
