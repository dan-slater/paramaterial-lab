---
title: Battery — capacity fade across cycling
slug: battery
---

# Battery — capacity fade across cycling

## Preamble: the same workflow in a different domain

The materials-science workflow that paramaterial was built for has three beats: load a family of specimens, extract one scalar parameter per specimen (yield stress, Young's modulus, Ramberg–Osgood exponent), and then plot that parameter against a test condition (temperature, strain rate, orientation). The scatter plot is the research artefact — it is how we answer questions like "how does yield stress depend on temperature for this alloy lot?"

Battery accelerated-aging studies are isomorphic. A specimen becomes a cell. A tensile test becomes an 800-cycle discharge-capacity record. Yield stress becomes Cycles to 80% SoH (analyzer key `cyclesTo80Pct`; registry key `Cyc80`). And the role played by test temperature in a high-temperature tensile campaign is played here by an operational condition — the C-rate at which the cell is charged and discharged. The central research question is the same species of question we ask about alloys: *how do chemistry, C-rate, and operating temperature interact to determine cycle life?*

That question is the one that accelerated-aging studies exist to answer, and it is a cross-sectional question. Once each cell has been reduced to a handful of scalar descriptors, the sweep across conditions becomes a single scatter plot. The point of this chapter is to walk through that reduction end-to-end on a synthetic dataset and to make the isomorphism with the materials workflow fully explicit.

## Dataset provenance

The `battery` preset shipped with v0.1 was a 50-cell synthetic stretched-exponential mock. It has been replaced, from v0.1.1 onward, with **real cycling data from the Toyota Research Institute / MIT / Stanford release** published by Severson et al. (2019). The builder at `scripts/build-battery.mjs` now fetches cell-level arrays from a public GitHub mirror, reconstructs per-cycle discharge capacity, and emits the same `Dataset` JSON schema as the rest of the presets.

> **Citation.** Severson, K. A., Attia, P. M., Jin, N., Perkins, N., Jiang, B., Yang, Z., Chen, M. H., Aykol, M., Herring, P. K., Fraggedakis, D., Bazant, M. Z., Harris, S. J., Chueh, W. C. & Braatz, R. D. (2019). Data-driven prediction of battery cycle life before capacity degradation. *Nature Energy* **4**, 383–391. [doi:10.1038/s41560-019-0356-8](https://doi.org/10.1038/s41560-019-0356-8).

The canonical release lives on matr.io (project `5c48dd2bc625d700019f3204`) under a CC-BY licence and is reproducible end-to-end from raw channel logs through the published `BuildPkl_Batch*.ipynb` pipeline. The mirror we fetch (`petermattia/revisit-severson-et-al`) redistributes the cell-level arrays derived from the same raw `.mat` files, together with an authoritative per-cell `cycle_lives` CSV whose end-of-life definition is the Severson convention: the cycle at which discharge capacity first drops below 0.88 Ah (80 % of the 1.1 Ah nominal rating of the A123 APR18650M1A cell). The full population is 124 commercial LFP/graphite 18650 cells cycled to end-of-life under a design matrix of fast-charging protocols chosen specifically to stress-test knee-onset prediction.

LFP (LiFePO₄) was Severson's choice, and it is the right contemporary demo chemistry: it dominates stationary grid storage and is now the default for mass-market LFV packs. Its degradation trajectory is unusually well documented — relatively flat early-life fade, a clear knee, and a long tail — which is precisely why it is the reference chemistry for knee-prediction research.

The per-cell metadata `policy` is Severson's fast-charge step-string (e.g. `3.6C(80%)-3.6C` meaning *charge at 3.6 C to 80 % SOC, then at 3.6 C to top-of-charge*, followed by a standard 4 C discharge). Unlike the v0.1 synthetic preset, which condensed an operating point into a single scalar `c_rate`, the real dataset encodes a **two-step time-varying protocol per cycle**. The `nominal_c_rate_charge` field preserved for registry scatter is merely the first C-rate number; it is not the full policy. This is exactly the "time-varying per-cycle metadata" issue the v0.1 chapter flagged under "Where paramaterial must generalise next", and the Severson substitution is the concrete reason that section is not hypothetical.

The cells are split into three experimental batches — batch1 (41 cells), batch2 (43 cells), batch3 (40 cells) — cycled on the same test hardware months apart, with small procedural and small chemistry-lot drifts between batches. Severson reports non-trivial batch effects, which is why the registry scatter should colour by `cell_group` as a fourth aesthetic dimension alongside the policy axes.

**Window caveat.** The public mirror redistributes only the first 99 cycles of per-cycle voltage-capacity arrays (the early-life window used by the follow-up prediction paper). Our builder therefore exports `stress[]` of length ~99 per cell — real, but truncated — while carrying the true full-life `cycle_life` scalar per cell as metadata. Running the builder against the raw matr.io `.mat` files locally would yield full-length Q(n) curves; the JSON schema already supports variable per-cell lengths from 150 to 2300+ cycles, so a local rerun drops in without any downstream changes.

**v0.2 numbers (refreshed 2026-04-22).** The numerical anchors from the v0.1 synthetic preset — `corr(cyclesTo80Pct, c_rate) ≈ −0.75`, a U-shaped temperature plot with clean 0 / 25 / 45 °C fade means, and "7 of 50 cells flagged with a knee" — do not carry across to the Severson-2019 dataset:

- **Temperature U-shape: unrecoverable.** All 124 cells were cycled nominally at 30 °C in a forced-convection chamber, so there is no temperature design matrix at all. Recovering a U-shape needs a different dataset (for example, a multi-temperature calendar-ageing campaign).
- **Rate-capability correlation collapses to ≈ 0.** `corr(cycle_life, nominal_c_rate_charge)` over the 124-cell catalog is **−0.03** (via `meta.cycle_life` vs `meta.nominal_c_rate_charge`). The v0.1 −0.75 was a mechanical artefact of a synthetic matrix that varied charge rate monotonically while holding everything else fixed; the Severson matrix co-varies charge rate with the SOC crossover point, the end-of-charge rate, and the cell cohort (batch1/2/3), and those other axes dominate cycle life at this C-rate range (3.6 → 8 C). Worked policies, for intuition: `3.6C(80%)-3.6C` → 1 852 cycles; `6C(40%)-3C` → 2 160; `5.3C(54%)-4C` → 2 237; `5.6C(19%)-4.6C` → 1 434 — the first-stage C-rate is a poor predictor.
- **Knee count: roadmap.** The public mirror redistributes only the first 99 cycles per cell, so `kneeCycle` returns `null` for almost every cell on this build. Recomputing the count needs the full-life Q(n) curves from the raw `matr.io` `.mat` files; the JSON schema already supports the wider cycle arrays.

The broader v0.2 lesson: the synthetic preset was designed for easy recovery of a single axis (C-rate → life); the real Severson dataset is a multi-axis fast-charge-policy search in which no single scalar covariate explains cycle life, and the scalars the tool currently ships are too impoverished to disentangle policy interactions without a richer model.

## The analyzers

The analyzer module is `src/lib/analyzers/battery.ts`. The contract is that a series exposes `strain: number[]` (cycle indices) and `stress: number[]` (discharge capacities in mAh/g, i.e. specific capacity per cathode active mass) — names inherited from the materials preset, retained so the parameter-extraction pipeline is domain-agnostic.

**`initialCapacity(series) → number`.** Mean of the first three finite capacity values. Used as the proxy for C₀ everywhere downstream. Averaging over three cycles de-sensitises the estimate to the measurement noise on any single cycle and to any brief formation-cycle transient.

**`currentCapacity(series) → number`.** The last finite capacity in the record — i.e. capacity at the most recent cycle.

**`fadePerCycle(series) → number`.** Average capacity lost per cycle across the full record, computed as `(y_first − y_last) / (x_last − x_first)`. Units: mAh/g per cycle. This is the crudest summary of cycle-life performance and it hides the non-linearity of the stretched exponential, but it is a useful one-number descriptor for ranking cells.

**`cyclesTo80Pct(series) → number | null`.** The first cycle index at which capacity drops strictly below `0.8 · initialCapacity`. Returns `null` if the threshold is never crossed (censored cell). This is the **end-of-life** definition used in most automotive battery specifications, and it is the canonical Y-axis variable for the scatter plot. The UI displays this analyzer as **Cycles to 80% SoH** (registry key `Cyc80`).

**`kneeCycle(series) → number | null`.** Detects a breakpoint in a two-segment piecewise-linear fit to the capacity curve. Implementation: a grid search over candidate breakpoints `k` at ~1 % stride, constrained so each segment contains at least `max(5, 10 % of n)` points; for each candidate, both segments are fit by ordinary least squares and the total sum of squared residuals is evaluated. The best-SSE breakpoint is then accepted only if both slopes are negative (capacity is decreasing on both sides) and `|slope_post| ≥ 2 · |slope_pre|`. If the 2× test fails, the function returns `null`, marking the cell as having no detectable knee.

**`retentionAt(series, cycle) → number`.** Capacity at the requested cycle (nearest-index lookup, skipping NaNs) divided by `initialCapacity`. The analyzer function itself accepts any cycle argument. The current UI registry, however, exposes only a single fixed entry at `cycle = 500`, labelled `Ret@500` (registry key `Ret500`). Parametric `Ret@N` for arbitrary `N` (so the same analyzer could produce `Ret@100`, `Ret@800`, etc. as user-selected entries) is **roadmap** (not shipped): the function supports it today, but no registry row yet exposes it to the UI.

## Recoverable relationships

Running the generator prints a smoke report at the end. The numerical anchors from that output are worth staring at because they are precisely what the scatter plot should show.

**Rate capability.** `corr(cyclesTo80Pct, c_rate) ≈ −0.75`. This is classic rate-capability degradation: doubling the C-rate roughly halves cycle life. The Pearson value is large and unambiguous because C-rate dominates the design matrix — it moves `k` by a factor of ≈3.7× from the 0.5 C cohort to the 3 C cohort, while chemistry only moves it by ~40 % and temperature by up to ~85 %.

**Temperature U-shape.** Mean `fadePerCycle` by operating temperature:

- 0 °C: ≈ 0.124 mAh/g per cycle
- 25 °C: ≈ 0.081 mAh/g per cycle
- 45 °C: ≈ 0.115 mAh/g per cycle

Fade at the two temperature extremes is ~40–50 % higher than at the 25 °C sweet spot. The U-shape built into `k` survives the analyzer pipeline cleanly, and because the U is non-monotone the Pearson correlation between temperature and fade is near zero — a useful reminder that a small correlation coefficient is not the same as no relationship.

**Knees.** Across 50 cells, approximately 7 are flagged as having a detectable knee, against ~12–13 that have an injected knee. The shortfall is intentional: the conservative `2×` slope criterion filters out knees that are masked by noise or by a gentle post-knee acceleration. Tightening or loosening that criterion is a worked example of how a single threshold choice in an analyzer changes the count that ends up on the plot.

## Reproducing in the web tool

![Cycles to 80% SoH vs C-rate (battery preset)](/docs-img/battery-scatter.png)

Pick the preset, then walk through the three blocks:

```
Preset: battery
Blocks: Stress–strain (color by c_rate)
      → Parameters
      → Parameter scatter (Y = Cycles to 80% SoH, X = c_rate)
```

The first block is the raw overlay. Axes read *cycle number* on X and *discharge capacity (mAh/g)* on Y despite the internal field names. Colour-by-`c_rate` produces four bands: a gently-decaying 0.5 C envelope at the top, a visibly-faster 3 C envelope at the bottom, and knees visible as kinks in a handful of individual traces. You can see the chemistry separation within each band if you switch the colour key to `chemistry`.

The Parameters block runs the analyzers across all 50 cells and gives a long table. The Parameter-scatter block is the punchline: Y = `cyclesTo80Pct`, X = `c_rate`, colour = `chemistry` or `temperature_c`. The plot is a clean monotonic decline in Cycles to 80% SoH across C-rate bins, with vertical spread inside each bin explained by the remaining two factors. The 0.5 C cohort sits high (many cells censored at 800 cycles); the 3 C cohort is tightly clustered near the bottom. Censored cells — those that never hit 80 % — are reported as `null` and are typically rendered at the top edge of the plot or excluded depending on the UI mode; this is the direct analogue of run-out specimens in a fatigue campaign.

## Limitations and extensions

The fade model is phenomenological. Real cells exhibit at least three mechanistically distinct degradation regimes that are lumped together here: Li-plating at low temperature and high rate, SEI growth that is superlinear in temperature and in time, and active-material loss from mechanical fatigue of the electrode. None of these is separable from the others in a single stretched-exponential fit. The knee detector is conservative and single-breakpoint; real cells often exhibit multi-stage degradation that a two-segment fit cannot resolve. The temperature dependence is a smooth U rather than the piecewise Arrhenius + Li-plating pattern that a proper kinetic model would produce.

Concrete extensions:

1. Replace the temperature penalty with an Arrhenius rate constant for SEI growth plus a separate low-temperature plating term with its own onset threshold.
2. Add coulombic-efficiency and internal-resistance channels as independent outputs, so analyzers like `ICE_avg` and `R_int_growth_rate` become first-class parameters.
3. Replace the single-breakpoint knee detector with an information-criterion model selection over 1-, 2-, and 3-segment fits.
4. Introduce calendar-ageing time as a covariate independent of cycle count, so the cross-section includes rest periods.
5. Model a chemistry-dependent Li-plating threshold in `(T, C-rate)` space and inject a corresponding qualitatively-different failure mode for cells that cross it.

Any one of these turns the dataset into a richer test bed without changing the analyzer contract or the scatter-plot workflow.

## How this maps back to materials

The isomorphism with the materials workflow is now exact:

- a **specimen** is a cell;
- a **tensile test** is the 800-cycle discharge record;
- **yield stress** is Cycles to 80% SoH (`cyclesTo80Pct`), with Young's modulus standing in for `initialCapacity` and the post-yield hardening exponent standing in for the knee-detector output;
- **test temperature** in a materials campaign is the **C-rate** here — the condition we sweep along the X-axis of the parameter scatter. Operating temperature plays the role of a secondary factor (colour key, grouping), closely analogous to strain rate in a mechanical campaign.

The point worth pressing is that the parameter-vs-parameter plot is the universal research artefact. Load the series, reduce each one to a scalar, and the cross-section of the design matrix collapses to a two-axis picture that a supervisor can read in ten seconds. The analyzers differ between domains; the workflow does not.

## References

- Severson, K. A., Attia, P. M., Jin, N., Perkins, N., Jiang, B., Yang, Z., Chen, M. H., Aykol, M., Herring, P. K., Fraggedakis, D., Bazant, M. Z., Harris, S. J., Chueh, W. C. & Braatz, R. D. (2019). Data-driven prediction of battery cycle life before capacity degradation. *Nature Energy* 4, 383–391.
- Broussely, M., Biensan, P., Bonhomme, F., Blanchard, P., Herreyre, S., Nechev, K. & Staniewicz, R. J. (2005). Main aging mechanisms in Li ion batteries. *Journal of Power Sources* 146, 90–96.
- Dubarry, M. & Beck, D. (2020). Big data training data for artificial intelligence-based Li-ion diagnosis and prognosis. *Journal of Power Sources* 479, 228806.
- Attia, P. M., Bills, A., Planella, F. B., Dechent, P., dos Reis, G., Dubarry, M., Gasper, P., Gilchrist, R., Greenbank, S., Howey, D., Liu, O., Khoo, E., Preger, Y., Soudbakhsh, D., Sun, Y., Teo, J. M., Wang, X., Yang, F., Zhang, X.-G., Zhang, Y. & Viswanathan, V. (2022). Review — "Knees" in lithium-ion battery aging trajectories. *Journal of The Electrochemical Society* 169, 060517.
