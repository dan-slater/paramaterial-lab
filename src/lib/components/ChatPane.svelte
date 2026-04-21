<script lang="ts">
	import { tick } from 'svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import ApiKeyModal from './ApiKeyModal.svelte';

	let input = $state('');
	let scrollBox: HTMLDivElement;
	let settingsOpen = $state(false);

	async function onSubmit(e: Event) {
		e.preventDefault();
		const text = input.trim();
		if (!text) return;
		input = '';
		await chatStore.send(text);
		await tick();
		if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
	}

	$effect(() => {
		chatStore.messages;
		if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
	});

	function openSettings() {
		settingsOpen = true;
	}

	function closeSettings() {
		settingsOpen = false;
		// API key may have changed; refresh mode indicator.
		chatStore.refreshMode();
	}

	// A tiny markdown-ish renderer: just bold (**x**) and line breaks.
	function formatText(t: string): string {
		return t
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/\n/g, '<br />');
	}
</script>

<aside
	class="flex h-full min-h-0 flex-col border-l"
	style="background: var(--surface-page); border-color: var(--border-default);"
>
	<header
		class="flex items-center justify-between border-b px-4 py-2.5"
		style="border-color: var(--border-default);"
	>
		<div>
			<p class="caption-eyebrow">Chat</p>
			<h2
				class="text-sm font-semibold tracking-tight"
				style="font-family: var(--font-serif); color: var(--text-primary);"
			>
				Assistant
			</h2>
			<p
				class="mt-0.5 text-[10px]"
				style="color: var(--text-muted);"
				data-testid="chat-mode"
			>
				{#if chatStore.usingClaude}
					<span class="inline-flex items-center gap-1">
						<span class="h-1.5 w-1.5 rounded-full" style="background: #10b981;"></span>
						using Claude
					</span>
				{:else}
					<span class="inline-flex items-center gap-1">
						<span
							class="h-1.5 w-1.5 rounded-full"
							style="background: var(--text-subtle);"
						></span>
						rule-based (no API key)
					</span>
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={openSettings}
				aria-label="Chat settings"
				title="API key settings"
				class="rounded-md border px-2 py-1 transition-colors"
				style="border-color: var(--border-default); color: var(--text-muted);"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-3.5 w-3.5"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="3"></circle>
					<path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
					></path>
				</svg>
			</button>
			<button
				type="button"
				onclick={() => chatStore.clear()}
				class="rounded-md border px-2 py-1 text-[10px] transition-colors"
				style="border-color: var(--border-default); color: var(--text-muted);"
			>
				Clear
			</button>
		</div>
	</header>

	<div bind:this={scrollBox} class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
		{#each chatStore.messages as m (m.id)}
			<div class="flex gap-2 text-sm">
				<span
					class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
					style={m.role === 'user'
						? 'background: var(--color-plasma-600); color: white;'
						: m.error
							? 'background: rgb(100 20 20 / 0.4); color: #fca5a5;'
							: 'background: var(--surface-chip); color: var(--accent-ui-strong);'}
				>
					{m.role === 'user' ? 'You' : m.error ? '!' : 'AI'}
				</span>
				<div class="min-w-0 flex-1">
					<div
						class="rounded-lg px-3 py-2 text-sm leading-relaxed"
						style={m.role === 'user'
							? 'background: color-mix(in srgb, var(--color-plasma-600) 16%, transparent); color: var(--text-primary);'
							: m.error
								? 'border: 1px solid rgb(150 40 40 / 0.5); background: rgb(100 20 20 / 0.25); color: #fca5a5;'
								: 'background: var(--surface-card); color: var(--text-primary);'}
					>
						{@html formatText(m.text)}
					</div>
				</div>
			</div>
		{/each}
		{#if chatStore.busy}
			<p class="pl-10 text-xs italic" style="color: var(--text-muted); font-family: var(--font-serif);">thinking…</p>
		{/if}
	</div>

	<form onsubmit={onSubmit} class="border-t p-3" style="border-color: var(--border-default);">
		<div class="flex items-end gap-2">
			<textarea
				bind:value={input}
				placeholder="Ask for an analysis or plot…"
				rows="2"
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						onSubmit(e);
					}
				}}
				class="min-h-0 flex-1 resize-none rounded-md border p-2 text-sm focus:outline-none"
				style="background: var(--surface-card); border-color: var(--border-default); color: var(--text-primary);"
			></textarea>
			<button
				type="submit"
				disabled={chatStore.busy || !input.trim()}
				class="shrink-0 rounded-md px-3 py-2 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed"
				style="background: var(--color-plasma-600);"
			>
				Send
			</button>
		</div>
		<p class="mt-1 text-[10px] italic" style="color: var(--text-muted); font-family: var(--font-serif);">
			Tip: "plot stress strain", "find proof stress", "representative by temperature", "UTS vs
			temperature".
		</p>
	</form>
</aside>

<ApiKeyModal open={settingsOpen} onClose={closeSettings} />
