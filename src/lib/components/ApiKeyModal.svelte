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
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgb(0 0 0 / 0.65); backdrop-filter: blur(4px);"
		onclick={onBackdrop}
	>
		<div
			class="w-full max-w-md rounded-lg border p-6"
			style="background: var(--surface-card); border-color: var(--border-strong); box-shadow: var(--shadow-md);"
			role="dialog"
			aria-modal="true"
			aria-labelledby="apikey-title"
		>
			<p class="caption-eyebrow">Settings</p>
			<h2
				id="apikey-title"
				class="mt-1 text-lg font-semibold"
				style="font-family: var(--font-serif); color: var(--text-primary); letter-spacing: -0.01em;"
			>
				Anthropic API key
			</h2>
			<p
				class="mt-2 text-sm italic"
				style="font-family: var(--font-serif); color: var(--text-secondary);"
			>
				Paste your Anthropic API key to enable real Claude-powered chat. Without a key the chat
				falls back to a basic rule-based intent matcher.
			</p>

			<div class="mt-5">
				<label class="caption-eyebrow" for="apikey-input" style="font-size: 10px;">
					API key
				</label>
				<div class="mt-2 flex gap-2">
					<input
						id="apikey-input"
						bind:value={draft}
						type={showKey ? 'text' : 'password'}
						autocomplete="off"
						spellcheck="false"
						placeholder={hasExisting ? 'Replace existing key…' : 'sk-ant-…'}
						class="min-w-0 flex-1 rounded-md border px-2 py-1.5 font-mono text-xs focus:outline-none"
						style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
					/>
					<button
						type="button"
						onclick={() => (showKey = !showKey)}
						class="shrink-0 rounded-md border px-2 py-1 text-[11px] transition-colors"
						style="border-color: var(--border-default); color: var(--text-secondary);"
					>
						{showKey ? 'Hide' : 'Show'}
					</button>
				</div>
				{#if hasExisting}
					<p class="mt-1 text-[11px]" style="color: var(--text-muted);">
						A key is currently saved in this browser.
					</p>
				{/if}
			</div>

			<div
				class="mt-4 rounded-md border p-3 text-[11px] leading-relaxed"
				style="background: rgb(180 130 30 / 0.12); border-color: rgb(180 130 30 / 0.35); color: #d6ad6a;"
			>
				<strong>Client-side only.</strong> Your key is stored in this browser's
				<code class="font-mono">localStorage</code> and sent directly to
				<code class="font-mono">api.anthropic.com</code>. It is not proxied through any server we
				run. Anyone with access to this browser profile can read it. Clear it when you're done.
			</div>

			<p class="mt-3 text-[11px]" style="color: var(--text-muted);">
				Need a key?
				<a
					href="https://console.anthropic.com/settings/keys"
					target="_blank"
					rel="noopener noreferrer"
					class="underline decoration-dotted"
					style="color: var(--color-plasma-400);"
				>
					console.anthropic.com/settings/keys
				</a>
			</p>

			<div class="mt-6 flex items-center justify-between">
				<button
					type="button"
					onclick={clear}
					disabled={!hasExisting}
					class="rounded-md border px-3 py-1.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
					style="border-color: var(--border-default); color: var(--text-secondary);"
				>
					Clear saved key
				</button>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={onClose}
						class="rounded-md border px-3 py-1.5 text-[11px] transition-colors"
						style="border-color: var(--border-default); color: var(--text-secondary);"
					>
						Close
					</button>
					<button
						type="button"
						onclick={save}
						disabled={!draft.trim()}
						class="rounded-md px-3 py-1.5 text-[11px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
						style="background: var(--color-plasma-600);"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
