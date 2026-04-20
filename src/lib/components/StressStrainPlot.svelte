<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import type { Test } from '$lib/datasets';

	interface Props {
		tests: Test[];
		colorBy?: string;
		height?: number;
	}

	let { tests, colorBy = 'temperature', height = 480 }: Props = $props();

	let container: HTMLDivElement;
	let plot: uPlot | null = null;

	// Viridis-inspired colormap — avoids near-black endpoints that disappear
	// against the dark background.
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
		// categorical fallback — hash to palette index
		const unique = Array.from(new Set(all.map(String)));
		const idx = unique.indexOf(String(value));
		return palette[idx % palette.length];
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
				spanGaps: false
			}))
		];
		// Compute explicit y range from data (avoid uPlot's auto-scale if it's failing)
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
					label: 'Strain',
					stroke: '#9ca3af',
					grid: { stroke: '#27272a', width: 1 },
					ticks: { stroke: '#3f3f46' }
				},
				{
					label: 'Stress (MPa)',
					stroke: '#9ca3af',
					grid: { stroke: '#27272a', width: 1 },
					ticks: { stroke: '#3f3f46' }
				}
			],
			legend: { show: false },
			cursor: {
				drag: { x: true, y: true, uni: 50 },
				focus: { prox: 16 }
			}
		};
	}

	function buildData(tests: Test[]): uPlot.AlignedData {
		// Raw strain data can be non-monotonic (elastic-region noise around zero).
		// uPlot requires strictly increasing x, so build a synthetic linspace grid
		// over the union range, then interpolate each test's (strain → stress) onto it.
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
			// First sort (sx, sy) by x ascending to tolerate noisy test data.
			// The paired sort is cheap: build indices array, sort, apply.
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
		return data;
	}

	function render() {
		if (!container) return;
		plot?.destroy();
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
		// re-render when props change
		tests;
		colorBy;
		render();
	});
</script>

<div bind:this={container} class="w-full"></div>
