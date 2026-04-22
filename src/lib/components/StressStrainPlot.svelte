<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import type { Test } from '$lib/datasets';

	interface Props {
		tests: Test[];
		colorBy?: string;
		height?: number;
		showOffset?: boolean;
		offsetStrain?: number;
		offsetE?: number;
		hiddenGroups?: Set<string>;
		xLabel?: string;
		yLabel?: string;
	}

	let {
		tests,
		colorBy = 'temperature',
		height = 480,
		showOffset = false,
		offsetStrain = 0.002,
		offsetE,
		hiddenGroups = new Set<string>(),
		xLabel = 'Strain',
		yLabel = 'Stress (MPa)'
	}: Props = $props();

	let container: HTMLDivElement;
	let plot: uPlot | null = null;
	let focusedIdx: number | null = null; // 1-based series index
	let isolatedIdx: number | null = null; // 1-based series index; null = no isolation
	let tooltipState = $state<{
		visible: boolean;
		left: number;
		top: number;
		placeRight: boolean;
		test: Test | null;
		strain: number;
		stress: number;
	}>({ visible: false, left: 0, top: 0, placeRight: false, test: null, strain: 0, stress: 0 });

	const palette = [
		'#6a00a8', '#8f0da4', '#b12a90', '#cc4778',
		'#e16462', '#f2844b', '#fca636', '#fcce25', '#f0f921'
	];

	function colorFor(value: unknown, all: unknown[]): string {
		const nums = all.map(Number).filter((v) => !Number.isNaN(v));
		if (nums.length && !Number.isNaN(Number(value))) {
			const min = Math.min(...nums);
			const max = Math.max(...nums);
			const t = max === min ? 0.5 : (Number(value) - min) / (max - min);
			const idx = Math.min(palette.length - 1, Math.max(0, Math.floor(t * (palette.length - 1))));
			return palette[idx];
		}
		const unique = Array.from(new Set(all.map(String)));
		const idx = unique.indexOf(String(value));
		return palette[idx % palette.length];
	}

	function isInitiallyHidden(t: Test): boolean {
		const groupVal = String(t.meta[colorBy] ?? '');
		return hiddenGroups.has(groupVal);
	}

	function buildOpts(tests: Test[], width: number): uPlot.Options {
		const allColorVals = tests.map((t) => t.meta[colorBy]);
		const series: uPlot.Series[] = [
			{ label: 'strain' },
			...tests.map((t) => ({
				label: t.test_id,
				stroke: colorFor(t.meta[colorBy], allColorVals),
				width: 1.2,
				alpha: 0.75,
				points: { show: false },
				spanGaps: false,
				show: !isInitiallyHidden(t)
			}))
		];
		if (showOffset) {
			series.push({
				label: `${offsetStrain * 100}% offset`,
				stroke: '#f0f921',
				width: 1.8,
				dash: [6, 4],
				points: { show: false },
				spanGaps: false
			});
		}
		let yMin = Infinity, yMax = -Infinity;
		for (const t of tests) {
			for (const v of t.stress) {
				if (Number.isFinite(v)) {
					if (v < yMin) yMin = v;
					if (v > yMax) yMax = v;
				}
			}
		}
		const yPad = (yMax - yMin) * 0.05;
		// Pull chart chrome from the active theme so axes/grid respect light/dark.
		const isLight =
			typeof document !== 'undefined' &&
			document.documentElement.getAttribute('data-theme') === 'light';
		const axisStroke = isLight ? '#4e4a3d' : '#9ca3af';
		const gridStroke = isLight ? 'rgba(40,35,25,0.12)' : '#27272a';
		const tickStroke = isLight ? 'rgba(40,35,25,0.3)' : '#3f3f46';

		return {
			width,
			height,
			series,
			scales: {
				x: { time: false },
				y: { range: [yMin - yPad, yMax + yPad] }
			},
			axes: [
				{
					label: xLabel,
					stroke: axisStroke,
					grid: { stroke: gridStroke, width: 1 },
					ticks: { stroke: tickStroke }
				},
				{
					label: yLabel,
					stroke: axisStroke,
					grid: { stroke: gridStroke, width: 1 },
					ticks: { stroke: tickStroke }
				}
			],
			legend: { show: false },
			cursor: {
				drag: { x: true, y: true, uni: 50 },
				focus: { prox: 16 }
			},
			hooks: {
				setSeries: [
					(_u, sIdx) => {
						// Fires when focus moves between series (or series toggled).
						focusedIdx = sIdx && sIdx >= 1 && sIdx <= tests.length ? sIdx : null;
						updateTooltipFromCursor();
					}
				],
				setCursor: [
					(_u) => {
						updateTooltipFromCursor();
					}
				]
			}
		};
	}

	function updateTooltipFromCursor() {
		if (!plot) {
			tooltipState.visible = false;
			return;
		}
		const fIdx = focusedIdx;
		const idx = plot.cursor.idx;
		const left = plot.cursor.left ?? -1;
		const top = plot.cursor.top ?? -1;
		if (fIdx == null || idx == null || left < 0 || top < 0) {
			tooltipState.visible = false;
			return;
		}
		const t = tests[fIdx - 1];
		if (!t) {
			tooltipState.visible = false;
			return;
		}
		const xVal = plot.data[0][idx];
		const yVal = plot.data[fIdx]?.[idx];
		if (yVal == null || !Number.isFinite(yVal) || xVal == null) {
			tooltipState.visible = false;
			return;
		}
		const plotW = container?.clientWidth ?? 0;
		const placeRight = left < plotW / 2;
		tooltipState = {
			visible: true,
			left,
			top,
			placeRight,
			test: t,
			strain: xVal as number,
			stress: yVal as number
		};
	}

	function buildData(tests: Test[]): uPlot.AlignedData {
		let minX = Infinity;
		let maxX = -Infinity;
		for (const t of tests) {
			for (let i = 0; i < t.strain.length; i++) {
				const v = t.strain[i];
				if (v < minX) minX = v;
				if (v > maxX) maxX = v;
			}
		}
		const N = 500;
		const x = new Array<number>(N);
		for (let i = 0; i < N; i++) {
			x[i] = minX + (i * (maxX - minX)) / (N - 1);
		}

		const data: uPlot.AlignedData = [x];
		for (const t of tests) {
			const sx = t.strain;
			const sy = t.stress;
			const idx = Array.from(sx.keys()).sort((a, b) => sx[a] - sx[b]);
			const sxs = new Array<number>(sx.length);
			const sys = new Array<number>(sx.length);
			for (let i = 0; i < idx.length; i++) {
				sxs[i] = sx[idx[i]];
				sys[i] = sy[idx[i]];
			}

			const y = new Array<number>(N);
			let j = 0;
			for (let i = 0; i < N; i++) {
				const xi = x[i];
				if (xi < sxs[0] || xi > sxs[sxs.length - 1]) {
					y[i] = NaN;
					continue;
				}
				while (j < sxs.length - 1 && sxs[j + 1] < xi) j++;
				if (sxs[j] === xi || j === sxs.length - 1) {
					y[i] = sys[j];
				} else {
					const x0 = sxs[j];
					const x1 = sxs[j + 1];
					const y0 = sys[j];
					const y1 = sys[j + 1];
					const denom = x1 - x0;
					y[i] = denom === 0 ? y0 : y0 + ((xi - x0) / denom) * (y1 - y0);
				}
			}
			data.push(y);
		}
		if (showOffset && typeof offsetE === 'number' && Number.isFinite(offsetE) && offsetE > 0) {
			let yMaxAll = -Infinity;
			for (const t of tests) {
				for (const v of t.stress) {
					if (Number.isFinite(v) && v > yMaxAll) yMaxAll = v;
				}
			}
			const offsetY = new Array<number>(N);
			for (let i = 0; i < N; i++) {
				const ye = offsetE * (x[i] - offsetStrain);
				offsetY[i] = ye < 0 || ye > yMaxAll * 1.05 ? NaN : ye;
			}
			data.push(offsetY);
		}
		return data;
	}

	function handleClick(ev: MouseEvent) {
		if (!plot) return;
		const fIdx = focusedIdx;
		if (fIdx == null) {
			// click on background → reset isolation
			if (isolatedIdx !== null) applyVisibility(null);
			return;
		}
		ev.stopPropagation();
		applyVisibility(isolatedIdx === fIdx ? null : fIdx);
	}

	function applyVisibility(newIsolated: number | null) {
		if (!plot) return;
		isolatedIdx = newIsolated;
		for (let i = 1; i <= tests.length; i++) {
			const t = tests[i - 1];
			const groupVal = String(t.meta[colorBy] ?? '');
			const groupHidden = hiddenGroups.has(groupVal);
			const isolatedHide = newIsolated !== null && newIsolated !== i;
			const show = !groupHidden && !isolatedHide;
			plot.setSeries(i, { show });
		}
	}

	function render() {
		if (!container) return;
		plot?.destroy();
		plot = null;
		focusedIdx = null;
		isolatedIdx = null;
		tooltipState.visible = false;
		if (!tests.length) return;
		const opts = buildOpts(tests, container.clientWidth);
		const data = buildData(tests);
		plot = new uPlot(opts, data, container);
	}

	onMount(() => {
		render();
		const ro = new ResizeObserver(() => {
			if (plot && container) plot.setSize({ width: container.clientWidth, height });
		});
		ro.observe(container);
		return () => ro.disconnect();
	});

	onDestroy(() => plot?.destroy());

	$effect(() => {
		// Re-render when tests/colorBy/offset-related props change (structure changes).
		tests;
		colorBy;
		showOffset;
		offsetStrain;
		offsetE;
		render();
	});

	// When only hiddenGroups changes, update visibility in-place without rebuild.
	$effect(() => {
		hiddenGroups;
		if (plot) applyVisibility(isolatedIdx);
	});

	function formatMetaValue(v: unknown): string {
		if (v == null) return '—';
		if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toPrecision(4);
		return String(v);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={container} class="relative w-full" onclick={handleClick}>
	{#if tooltipState.visible && tooltipState.test}
		{@const offset = 12}
		{@const cw = container?.clientWidth ?? 0}
		<div
			data-testid="plot-tooltip"
			class="pointer-events-none absolute z-10 max-w-xs rounded-md border px-2.5 py-2 text-xs"
			style={`${tooltipState.placeRight
				? `left: ${tooltipState.left + offset}px;`
				: `right: ${cw - tooltipState.left + offset}px;`} top: ${Math.max(0, tooltipState.top - offset)}px; background: var(--surface-card); border-color: var(--border-strong); color: var(--text-primary); box-shadow: var(--shadow-md);`}
		>
			<div class="font-mono text-[11px]" style="color: var(--color-plasma-400);">{tooltipState.test.test_id}</div>
			<div class="mt-0.5 tabular-nums" style="color: var(--text-secondary);">
				ε = {tooltipState.strain.toPrecision(4)}, σ = {tooltipState.stress.toFixed(1)} MPa
			</div>
			{#if Object.keys(tooltipState.test.meta).length}
				<div class="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
					{#each Object.entries(tooltipState.test.meta) as [k, v]}
						<span style="color: var(--text-muted);">{k}</span>
						<span class="truncate" style="color: var(--text-primary);">{formatMetaValue(v)}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
