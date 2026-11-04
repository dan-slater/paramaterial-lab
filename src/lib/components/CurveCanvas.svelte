<script lang="ts" module>
	export interface CurveLayer {
		curves: Array<{ x: number[]; y: number[]; color: string }>;
		alpha?: number;
		width?: number;
		dash?: number[];
	}
	export interface CurveLine {
		/** A point on the line and its slope (matplotlib axline). */
		x0: number;
		y0: number;
		slope: number;
		color: string;
		dash?: number[];
	}
	export interface CurveMarker {
		x: number;
		y: number;
		color: string;
		label?: string;
	}
</script>

<script lang="ts">
	// Lightweight canvas plot for many curves: before/after overlays and the
	// screening small multiples, where one uPlot per test would be too heavy.
	import { onMount } from 'svelte';

	interface Props {
		layers: CurveLayer[];
		lines?: CurveLine[];
		markers?: CurveMarker[];
		height?: number;
		/** Draw tick labels and axis titles (off for small multiples). */
		axes?: boolean;
		xLabel?: string;
		yLabel?: string;
		xRange?: [number, number] | null;
		yRange?: [number, number] | null;
		ariaLabel?: string;
	}

	let {
		layers,
		lines = [],
		markers = [],
		height = 320,
		axes = true,
		xLabel = '',
		yLabel = '',
		xRange = null,
		yRange = null,
		ariaLabel = 'Plot'
	}: Props = $props();

	let wrap: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let width = $state(0);

	function niceTicks(lo: number, hi: number, n: number): number[] {
		const span = hi - lo;
		if (!(span > 0)) return [lo];
		const raw = span / n;
		const mag = Math.pow(10, Math.floor(Math.log10(raw)));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? 10 * mag;
		const out: number[] = [];
		for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
		return out;
	}

	function fmt(v: number): string {
		if (v === 0) return '0';
		const a = Math.abs(v);
		if (a >= 1000) return v.toFixed(0);
		if (a >= 1) return +v.toPrecision(4) + '';
		return +v.toPrecision(3) + '';
	}

	function bounds(): { x: [number, number]; y: [number, number] } {
		let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
		for (const L of layers) {
			for (const c of L.curves) {
				for (let i = 0; i < c.x.length; i++) {
					const x = c.x[i], y = c.y[i];
					if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
					if (xRange && (x < xRange[0] || x > xRange[1])) continue;
					if (x < x0) x0 = x;
					if (x > x1) x1 = x;
					if (y < y0) y0 = y;
					if (y > y1) y1 = y;
				}
			}
		}
		if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
		const xr: [number, number] = xRange ?? [x0, x1 === x0 ? x0 + 1 : x1];
		const pad = (y1 - y0) * 0.05 || 1;
		const yr: [number, number] = yRange ?? [Math.min(0, y0 - pad), y1 + pad];
		return { x: xr, y: yr };
	}

	function draw() {
		if (!canvas || width <= 0) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		const css = getComputedStyle(canvas);
		// Colours may be CSS variables (var(--token)); canvas needs them resolved.
		const col = (c: string) =>
			c.startsWith('var(') ? css.getPropertyValue(c.slice(4, -1).trim()).trim() || '#888' : c;
		const muted = css.getPropertyValue('--text-muted').trim() || '#807a68';
		const grid = css.getPropertyValue('--border-default').trim() || 'rgba(60,50,30,0.14)';

		const m = axes ? { l: 54, r: 10, t: 8, b: 40 } : { l: 2, r: 2, t: 2, b: 2 };
		const pw = Math.max(10, width - m.l - m.r);
		const ph = Math.max(10, height - m.t - m.b);
		const { x: xr, y: yr } = bounds();
		const sx = (v: number) => m.l + ((v - xr[0]) / (xr[1] - xr[0])) * pw;
		const sy = (v: number) => m.t + ph - ((v - yr[0]) / (yr[1] - yr[0])) * ph;

		ctx.font = '11px Inter, ui-sans-serif, system-ui, sans-serif';
		ctx.lineWidth = 1;
		ctx.strokeStyle = grid;
		ctx.fillStyle = muted;
		if (axes) {
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';
			for (const v of niceTicks(xr[0], xr[1], Math.max(3, Math.floor(pw / 80)))) {
				const px = sx(v);
				ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
				ctx.fillText(fmt(v), px, m.t + ph + 5);
			}
			ctx.textAlign = 'right';
			ctx.textBaseline = 'middle';
			for (const v of niceTicks(yr[0], yr[1], Math.max(3, Math.floor(ph / 50)))) {
				const py = sy(v);
				ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
				ctx.fillText(fmt(v), m.l - 6, py);
			}
			ctx.textAlign = 'center';
			ctx.textBaseline = 'bottom';
			if (xLabel) ctx.fillText(xLabel, m.l + pw / 2, height - 2);
			if (yLabel) {
				ctx.save();
				ctx.translate(12, m.t + ph / 2);
				ctx.rotate(-Math.PI / 2);
				ctx.textBaseline = 'middle';
				ctx.fillText(yLabel, 0, 0);
				ctx.restore();
			}
		} else {
			// Zero lines only, so a shifted foot reads at a glance.
			ctx.beginPath();
			if (xr[0] < 0 && xr[1] > 0) { ctx.moveTo(sx(0), m.t); ctx.lineTo(sx(0), m.t + ph); }
			if (yr[0] < 0 && yr[1] > 0) { ctx.moveTo(m.l, sy(0)); ctx.lineTo(m.l + pw, sy(0)); }
			ctx.stroke();
		}

		ctx.save();
		ctx.beginPath();
		ctx.rect(m.l, m.t, pw, ph);
		ctx.clip();
		ctx.lineJoin = 'round';
		for (const L of layers) {
			ctx.globalAlpha = L.alpha ?? 1;
			ctx.lineWidth = L.width ?? 1.2;
			ctx.setLineDash(L.dash ?? []);
			for (const c of L.curves) {
				ctx.strokeStyle = col(c.color);
				ctx.beginPath();
				let pen = false;
				// Thin dense curves to about one vertex per pixel column.
				const step = Math.max(1, Math.floor(c.x.length / (pw * 2)));
				for (let i = 0; i < c.x.length; i += step) {
					const x = c.x[i], y = c.y[i];
					if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
					if (pen) ctx.lineTo(sx(x), sy(y));
					else { ctx.moveTo(sx(x), sy(y)); pen = true; }
				}
				ctx.stroke();
			}
		}
		ctx.globalAlpha = 1;
		for (const ln of lines) {
			ctx.strokeStyle = col(ln.color);
			ctx.lineWidth = 1.3;
			ctx.setLineDash(ln.dash ?? [5, 4]);
			ctx.beginPath();
			ctx.moveTo(sx(xr[0]), sy(ln.y0 + ln.slope * (xr[0] - ln.x0)));
			ctx.lineTo(sx(xr[1]), sy(ln.y0 + ln.slope * (xr[1] - ln.x0)));
			ctx.stroke();
		}
		ctx.setLineDash([]);
		for (const mk of markers) {
			ctx.fillStyle = col(mk.color);
			ctx.strokeStyle = css.getPropertyValue('--surface-card').trim() || '#fff';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc(sx(mk.x), sy(mk.y), axes ? 4.5 : 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			if (mk.label && axes) {
				ctx.fillStyle = muted;
				ctx.textAlign = 'left';
				ctx.textBaseline = 'bottom';
				ctx.fillText(mk.label, sx(mk.x) + 7, sy(mk.y) - 3);
			}
		}
		ctx.restore();
	}

	onMount(() => {
		const ro = new ResizeObserver(() => {
			width = wrap.clientWidth;
		});
		ro.observe(wrap);
		width = wrap.clientWidth;
		// Redraw on theme toggle (colours come from CSS variables).
		const mo = new MutationObserver(() => draw());
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => {
			ro.disconnect();
			mo.disconnect();
		};
	});

	$effect(() => {
		// Track every input, then draw.
		void [layers, lines, markers, height, axes, xLabel, yLabel, xRange, yRange, width];
		draw();
	});
</script>

<div bind:this={wrap} class="w-full" style={`height: ${height}px;`} role="img" aria-label={ariaLabel}>
	<canvas bind:this={canvas} aria-hidden="true" style={`width: 100%; height: ${height}px; display: block;`}
	></canvas>
</div>
