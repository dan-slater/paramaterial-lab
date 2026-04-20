<script lang="ts">
	import { tick } from 'svelte';
	import { chatStore } from '$lib/stores/chat.svelte';

	let input = $state('');
	let scrollBox: HTMLDivElement;

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

<aside class="flex h-full min-h-0 flex-col border-l border-neutral-800 bg-neutral-950">
	<header class="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
		<div>
			<p class="text-xs uppercase tracking-wider text-neutral-500">Chat</p>
			<h2 class="text-sm font-semibold tracking-tight">Assistant</h2>
		</div>
		<button
			type="button"
			onclick={() => chatStore.clear()}
			class="rounded-md border border-neutral-800 px-2 py-1 text-[10px] text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
		>
			Clear
		</button>
	</header>

	<div bind:this={scrollBox} class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
		{#each chatStore.messages as m (m.id)}
			<div class="flex gap-2 text-sm">
				<span
					class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium
					{m.role === 'user'
						? 'bg-plasma-600 text-white'
						: 'bg-neutral-800 text-plasma-400'}"
				>
					{m.role === 'user' ? 'You' : 'AI'}
				</span>
				<div class="min-w-0 flex-1">
					<div
						class="rounded-lg px-3 py-2 text-sm leading-relaxed
						{m.role === 'user'
							? 'bg-plasma-600/20 text-plasma-100'
							: 'bg-neutral-900 text-neutral-200'}"
					>
						{@html formatText(m.text)}
					</div>
				</div>
			</div>
		{/each}
		{#if chatStore.busy}
			<p class="pl-10 text-xs text-neutral-500">thinking…</p>
		{/if}
	</div>

	<form onsubmit={onSubmit} class="border-t border-neutral-800 p-3">
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
				class="min-h-0 flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-900 p-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-plasma-500 focus:outline-none"
			></textarea>
			<button
				type="submit"
				disabled={chatStore.busy || !input.trim()}
				class="shrink-0 rounded-md bg-plasma-600 px-3 py-2 text-xs font-medium text-white hover:bg-plasma-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
			>
				Send
			</button>
		</div>
		<p class="mt-1 text-[10px] text-neutral-600">
			Tip: "plot stress strain", "find proof stress", "representative by temperature", "UTS vs temperature".
		</p>
	</form>
</aside>
