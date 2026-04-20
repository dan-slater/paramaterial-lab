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

	// plasma colormap (approximated as 11 stops)
	const plasma = [
		'#0d0887', '#41049d', '#6a00a8', '#8f0da4', '#b12a90',
		'#cc4778', '#e16462', '#f2844b', '#fca636', '#fcce25', '#f0f921'
	];

	function colorFor(value: unknown, all: unknown[]): string {
		const nums = all.map(Number).filter((v) => !Number.isNaN(v));
		if (nums.length && !Number.isNaN(Number(value))) {
			const min = Math.min(...nums);
			const max = Math.max(...nums);
			const t = max === min ? 0.5 : (Number(value) - min) / (max - min);
			const idx = Math.min(plasma.length - 1, Math.max(0, Math.floor(t * (plasma.length - 1))));
			return plasma[idx];
		}
		// categorical fallback — hash to plasma index
		const unique = Array.from(new Set(all.map(String)));
		const idx = unique.indexOf(String(value));
		return plasma[idx % plasma.length];
	}

	function buildOpts(tests: Test[], width: number): uPlot.Options {
		const allColorVals = tests.map((t) => t.meta[colorBy]);
		const series: uPlot.Series[] = [
			{ label: 'strain' },
			...tests.map((t) => ({
				label: t.test_id,
				stroke: colorFor(t.meta[colorBy], allColorVals),
				width: 1,
				points: { show: false }
			}))
		];
		return {
			width,
			height,
			series,
			scales: {
				x: { time: false },
				y: {}
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
		// Build a unified x-axis by collecting all unique strain values, then interpolate each test.
		// For performance we instead use a padded approach: take the longest strain series as x,
		// and pad shorter tests with NaN. uPlot tolerates NaN gaps.
		const maxLen = Math.max(...tests.map((t) => t.strain.length));
		const xRef = tests.reduce((a, b) => (b.strain.length > a.strain.length ? b : a)).strain;
		const x = xRef.slice(0, maxLen);
		const data: uPlot.AlignedData = [x as unknown as number[]];
		for (const t of tests) {
			const y = new Array<number>(x.length);
			// Simple linear interpolation onto the reference x grid
			let j = 0;
			for (let i = 0; i < x.length; i++) {
				const xi = x[i];
				while (j < t.strain.length - 1 && t.strain[j + 1] < xi) j++;
				if (xi < t.strain[0] || xi > t.strain[t.strain.length - 1]) {
					y[i] = NaN;
				} else if (t.strain[j] === xi) {
					y[i] = t.stress[j];
				} else {
					const x0 = t.strain[j];
					const x1 = t.strain[j + 1];
					const y0 = t.stress[j];
					const y1 = t.stress[j + 1];
					y[i] = y0 + ((xi - x0) / (x1 - x0)) * (y1 - y0);
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
