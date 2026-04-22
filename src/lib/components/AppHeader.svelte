<script lang="ts">
	import { onMount } from 'svelte';
	import { sessionStore } from '$lib/stores/session.svelte';
	import AppDrawer from './AppDrawer.svelte';
	import AuthModal from './AuthModal.svelte';

	let {
		rightSlot,
		subtitle
	}: {
		rightSlot?: import('svelte').Snippet;
		subtitle?: string;
	} = $props();

	let drawerOpen = $state(false);
	let authOpen = $state(false);

	const THEME_KEY = 'paramaterial:theme:v1';
	let theme = $state<'dark' | 'light'>('dark');

	function applyTheme(t: 'dark' | 'light') {
		theme = t;
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', t);
		}
		try {
			localStorage.setItem(THEME_KEY, t);
		} catch {
			/* ignore */
		}
	}
	function toggleTheme() {
		applyTheme(theme === 'dark' ? 'light' : 'dark');
	}

	function onHamburger() {
		if (sessionStore.user) {
			drawerOpen = true;
		} else {
			authOpen = true;
		}
	}

	onMount(() => {
		const attr = document.documentElement.getAttribute('data-theme');
		theme = attr === 'light' ? 'light' : 'dark';
	});
</script>

<header
	class="relative z-50 flex shrink-0 items-center justify-between border-b px-4 py-2.5 backdrop-blur"
	style="background: color-mix(in srgb, var(--surface-raised) 88%, transparent); border-color: var(--border-default);"
>
	<div class="flex items-center gap-3">
		<button
			type="button"
			onclick={onHamburger}
			aria-label="Open menu"
			class="rounded-md border px-2 py-1.5 transition-colors"
			style="border-color: var(--border-default); color: var(--text-secondary);"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-4 w-4"
				aria-hidden="true"
			>
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</button>
		<a
			href="/"
			class="flex items-center gap-2 text-base font-semibold tracking-tight"
			style="color: var(--text-primary);"
		>
			<span
				class="inline-block h-5 w-5 rounded"
				style="background: linear-gradient(135deg, var(--color-plasma-400), var(--color-plasma-700));"
				aria-hidden="true"
			></span>
			<span class="font-serif" style="letter-spacing: -0.01em;">paramaterial</span>
		</a>
		{#if subtitle}
			<span class="hidden text-xs sm:inline" style="color: var(--text-muted);">
				· {subtitle}
			</span>
		{/if}
	</div>

	<div class="flex items-center gap-2 text-xs" style="color: var(--text-muted);">
		{#if rightSlot}{@render rightSlot()}{/if}
		<a
			href="/docs"
			class="hidden rounded-md border px-2 py-1 text-xs transition-colors sm:inline-block"
			style="border-color: var(--border-default); color: var(--text-secondary);"
			title="Documentation"
		>
			Docs
		</a>
		<button
			type="button"
			onclick={toggleTheme}
			aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
			aria-pressed={theme === 'light'}
			title={theme === 'dark' ? 'Light (paper) theme' : 'Dark theme'}
			class="rounded-md border px-2 py-1 text-xs transition-colors"
			style="border-color: var(--border-default); color: var(--text-secondary); background: transparent;"
		>
			{#if theme === 'dark'}
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
					<circle cx="12" cy="12" r="4"></circle>
					<path
						d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
					/>
				</svg>
			{:else}
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
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>
	</div>
</header>

<AppDrawer bind:open={drawerOpen} />
<AuthModal bind:open={authOpen} />
