---
title: Battery — capacity fade across cycling
slug: battery
---

# Battery — capacity fade across cycling

## Preamble: the same workflow in a different domain

The materials-science workflow that paramaterial was built for has three beats: load a family of specimens, extract one scalar parameter per specimen (yield stress, Young's modulus, Ramberg–Osgood exponent), and then plot that parameter against a test condition (temperature, strain rate, orientation). The scatter plot is the research artefact — it is how we answer questions like "how does yield stress depend on temperature for this alloy lot?"

Battery accelerated-aging studies are isomorphic. A specimen becomes a cell. A tensile test becomes a cell's discharge-capacity record. Yield stress becomes Cycles to 80% SoH (analyzer key `cyclesTo80Pct`; registry key `Cyc80`). And the role played by test temperature in a high-temperature tensile campaign is played here by an operational condition — the C-rate at which the cell is charged and discharged. The central research question is the same species of question we ask about alloys: *how does the charging protocol determine cycle life?*

That question is the one that accelerated-aging studies exist to answer, and it is a cross-sectional question. Once each cell has been reduced to a handful of scalar descriptors, the sweep across conditions becomes a single scatter plot. The point of this chapter is to walk through that reduction end-to-end on a real dataset, to make the isomorphism with the materials workflow explicit, and to be clear about what this dataset can and cannot show.

## Dataset provenance

The `battery` preset shipped with v0.1 was a 50-cell synthetic stretched-exponential mock. It has been replaced, from v0.1.1 onward, with **real cycling data from the Toyota Research Institute / MIT / Stanford release** published by Severson et al. (2019). The builder at `scripts/build-battery.mjs` now fetches cell-level arrays from a public GitHub mirror, reconstructs per-cycle discharge capacity, and emits the same `Dataset` JSON schema as the rest of the presets.

> **Citation.** Severson, K. A., Attia, P. M., Jin, N., Perkins, N., Jiang, B., Yang, Z., Chen, M. H., Aykol, M., Herring, P. K., Fraggedakis, D., Bazant, M. Z., Harris, S. J., Chueh, W. C. & Braatz, R. D. (2019). Data-driven prediction of battery cycle life before capacity degradation. *Nature Energy* **4**, 383–391. [doi:10.1038/s41560-019-0356-8](https://doi.org/10.1038/s41560-019-0356-8).

The canonical release lives on matr.io (project `5c48dd2bc625d700019f3204`) under a CC-BY licence and is reproducible end-to-end from raw channel logs through the published `BuildPkl_Batch*.ipynb` pipeline. The mirror we fetch (`petermattia/revisit-severson-et-al`) redistributes the cell-level arrays derived from the same raw `.mat` files, together with an authoritative per-cell `cycle_lives` CSV whose end-of-life definition is the Severson convention: the cycle at which discharge capacity first drops below 0.88 Ah (80 % of the 1.1 Ah nominal rating of the A123 APR18650M1A cell). The full population is 124 commercial LFP/graphite 18650 cells cycled to end-of-life under a design matrix of fast-charging protocols chosen specifically to stress-test knee-onset prediction.

LFP (LiFePO₄) was Severson's choice, and it is the right contemporary demo chemistry: it dominates stationary grid storage and is now the default for many mass-market EV packs. Its degradation trajectory is unusually well documented — relatively flat early-life fade, a clear knee, and a long tail — which is precisely why it is the reference chemistry for knee-prediction research.

The per-cell metadata `policy` is Severson's fast-charge step-string (e.g. `3.6C(80%)-3.6C` meaning *charge at 3.6 C to 80 % SOC, then at 3.6 C to top-of-charge*, followed by a standard 4 C discharge). Unlike the v0.1 synthetic preset, which condensed an operating point into a single scalar `c_rate`, the real dataset encodes a **two-step time-varying protocol per cycle**. The `nominal_c_rate_charge` field preserved for registry scatter is merely the first C-rate number; it is not the full policy. This is exactly the "time-varying per-cycle metadata" issue the v0.1 chapter flagged under "Where paramaterial must generalise next", and the Severson substitution is the concrete reason that section is not hypothetical.

The cells are split into three experimental batches — batch1 (41 cells), batch2 (43 cells), batch3 (40 cells) — cycled on the same test hardware months apart, with small procedural and small chemistry-lot drifts between batches. Severson reports non-trivial batch effects, which is why the registry scatter should colour by `cell_group` as a fourth aesthetic dimension alongside the policy axes.

**Window caveat.** The public mirror redistributes only the early-life per-cycle arrays (Severson cycles 2–100, the window used by the follow-up prediction work). Our builder therefore exports 99 capacity points per cell, `max(Qdlin)` per cycle, in **Ah**. The x-axis (`strain`) is the index 0…98 into that window, so index *i* is Severson cycle *i* + 2. Each cell also carries its true full-life `cycle_life` as metadata. Running the builder against the raw matr.io `.mat` files would yield full-length Q(n) curves of 150 to 2 300+ cycles; the JSON schema already supports variable per-cell lengths, so a local rerun drops in without downstream changes.


**What the v0.1 numbers became.** The v0.1 synthetic preset was built around `corr(cyclesTo80Pct, c_rate) ≈ −0.75`, a U-shaped fade-vs-temperature plot, and "7 of 50 cells flagged with a knee". None of that carries over, and the sections below do not pretend otherwise:

- **There is no temperature axis.** All 124 cells were cycled nominally at 30 °C in a forced-convection chamber, and the JSON has no temperature field.
- **First-step C-rate does not predict cycle life.** `corr(cycle_life, nominal_c_rate_charge)` over the 124 cells is **−0.03**. The Severson matrix co-varies the first-step rate (3.6 → 8 C) with the SOC switch point, the second-step rate and the batch, and those dominate.
- **`cyclesTo80Pct` cannot fire.** No cell loses 20 % of its capacity inside the 99-cycle window (median retention at index 90 is 0.997, the lowest 0.914), so the analyzer returns `null` for all 124 cells. End of life comes from `meta.cycle_life` instead.

All numbers in this chapter are computed by `node scripts/chapter-numbers.mjs` from the shipped `static/data/battery.json`.

## The analyzers

The analyzer module is `src/lib/analyzers/battery.ts`. The contract is that a series exposes `strain: number[]` (cycle index) and `stress: number[]` (discharge capacity in **Ah**, as emitted by the builder for these 1.1 Ah cells). The field names are inherited from the materials preset so the parameter-extraction pipeline is domain-agnostic.

**`initialCapacity(series) → number`.** Mean of the first three finite capacity values, in Ah. Used as the proxy for C₀ everywhere downstream. Averaging over three cycles de-sensitises the estimate to measurement noise on any single cycle. On this preset C₀ runs 1.024–1.083 Ah (median 1.057).

**`currentCapacity(series) → number`.** The last finite capacity in the record, in Ah. Here that is index 98 (Severson cycle 100).

**`fadePerCycle(series) → number`.** Average capacity lost per cycle across the record, `(y_first − y_last) / (x_last − x_first)`, in Ah/cycle. It hides any curvature but ranks cells usefully. On this preset the median is 3.4 × 10⁻⁵ Ah/cycle; a few cells are slightly negative (capacity rose over the window).

**`cyclesTo80Pct(series) → number | null`.** The first cycle index at which capacity drops strictly below `0.8 · initialCapacity`; `null` if the threshold is never crossed (a censored cell). This is the usual automotive end-of-life definition, displayed as **Cycles to 80% SoH** (registry key `Cyc80`). On this window it is `null` for every cell, as explained above.

**`kneeCycle(series) → number | null`.** Detects a breakpoint in a two-segment piecewise-linear fit to the capacity curve. Implementation: a grid search over candidate breakpoints `k` at ~1 % stride, constrained so each segment contains at least `max(5, 10 % of n)` points; for each candidate, both segments are fit by ordinary least squares and the total sum of squared residuals is evaluated. The best-SSE breakpoint is then accepted only if both slopes are negative (capacity is decreasing on both sides) and `|slope_post| ≥ 2 · |slope_pre|`. Otherwise it returns `null`. On this window it flags 18 of 124 cells. These are early-life slope changes inside the first 99 cycles, not the end-of-life knee the Severson papers study; that knee lies hundreds of cycles beyond the window.

**`retentionAt(series, cycle) → number`.** Capacity at the requested cycle (nearest-index lookup, skipping NaNs) divided by `initialCapacity`. It does not extrapolate: a cycle past the end of the record returns NaN, which the UI shows as "—". The registry exposes one fixed entry, **Retention @ cycle 500** (`Ret500`), which is therefore blank for every cell on this window. Parametric `Ret@N` with a user-chosen `N` is roadmap: the function supports any cycle, but no registry row exposes it yet.

### Model fit — stretched exponential

`fitStretchedExp(series)` fits

```
C(n) = C₀ · exp(−k · n^α)
```

with C₀ fixed to `initialCapacity` (nudged up by 0.05 % so every C(n) < C₀). Taking logs twice linearises the model,

```
ln(ln(C₀ / C(n))) = ln k + α · ln n
```

and the fit is a single closed-form ordinary least squares on `(ln n, ln ln(C₀/C(n)))`. There is no iterative refinement. Points are dropped where the transform is undefined: `n < 1` (index 0) and `C(n) ≥ C₀`. At least three usable points are required, and the fit fails (NaN coefficients) if fewer remain or if `k ≤ 0`. R² is reported on the original capacity residuals, not the log-log ones, because that is the error a reader cares about. Two scalars are registered: **Fade exponent α** (`FadeExp`, from `fadeExponent`) and **Fade rate constant k** (`FadeK`, from `fadeRateConstant`).

On this preset the fit is **weak**, and the numbers should be read that way. It succeeds on 113 of 124 cells. Across those, median R² is 0.11; 55 fits score below zero (worse than a flat line) and 12 score above 0.9. Median α is 0.81 but the range runs from −0.30 to 5.5. The reason is the window: over the first 99 cycles capacity barely moves, so `ln(C₀/C(n))` is dominated by measurement noise, and a double log amplifies it. The model is meant for full-life records with visible fade; on early-life data it is the wrong tool, and α and k here are not physical parameters.

## Recoverable relationships

The canonical plot is `cycle_life` (true Severson end of life, 148–2 237 cycles, median 731) against `nominal_c_rate_charge` (3.6–8 C, median 4.8). Correlations across the 124 cells (Pearson r):

| Relationship | r | Reading |
|---|---|---|
| `cycle_life` vs `nominal_c_rate_charge` | **−0.03** | No signal. The first-step rate is the wrong scalar for this design matrix. |
| `cycle_life` vs `fadePerCycle` | **−0.46** | Cells that fade faster early die sooner. |
| `cycle_life` vs `fadeExponent` | **−0.45** | Similar, through a noisy fit. |
| `cycle_life` vs `initialCapacity` | **−0.04** | No signal. |

**Batch dominates.** Median cycle life is 842 in batch1 (41 cells, range 534–2 237), 481 in batch2 (43 cells, 148–713) and 940 in batch3 (40 cells, 541–1 935). Batch2 cells die young whatever the protocol. The same policy shows it directly: the nine `3.6C(80%)-3.6C` cells live 862–1 852 cycles in batch1 but 300–487 in batch2. Every one of the 27 distinct policies has at least three cells, so policy-level spreads like this are visible throughout.

**Early fade carries information about end of life.** The −0.46 between `fadePerCycle` over cycles 2–100 and full-life `cycle_life` is the same idea as the Severson paper, in its crudest form. Severson et al. predict cycle life far better from features of the discharge-voltage curves (the variance of ΔQ(V) between cycles 10 and 100), which this dataset does not carry. The point here is that a one-number summary of the first 100 cycles already says something about the next thousand.

## Reproducing in the web tool

![cycle_life vs nominal_c_rate_charge (battery preset)](/docs-img/battery-scatter.png)

Open `/lab/battery` (which applies this template) or pick the **Battery** preset:

```
Preset: battery
Blocks: Stress–strain (color by cell_group)
      → Parameters
      → Parameter scatter (Y = cycle_life, X = nominal_c_rate_charge)
```

The first block overlays the 124 capacity records. Axes read *cycle number* on X (the 0–98 window index) and *Discharge capacity (Ah)* on Y. The traces are nearly flat bands around 1.02–1.08 Ah; colouring by `cell_group` separates the three batches.

The Parameters block runs the battery analyzers across all 124 cells. Expect `Cycles to 80% SoH` and `Retention @ cycle 500` to be blank for every row on this window, and `Knee cycle` to be filled for 18.

The Parameter-scatter block with Y = `cycle_life`, X = `nominal_c_rate_charge` shows a flat cloud: the −0.03. Swap X to **Fade per cycle** to see the −0.46. The scatter has no colour key yet, so the batch effect is read from the overlay and the Parameters table rather than from the scatter.

## Limitations and extensions

- **Early-life window only.** 99 cycles per cell, so end-of-life analyzers (`cyclesTo80Pct`, `retentionAt(500)`, the end-of-life knee) cannot fire, and the stretched-exponential fit has almost no fade to fit.
- **One scalar for a two-step policy.** `nominal_c_rate_charge` is the first-step rate; the SOC switch point and the second-step rate are only in the `policy` string, which the scatter cannot use.
- **No temperature, resistance or coulombic-efficiency channels.** Only discharge capacity per cycle is exported.
- **Phenomenological fade model.** Real cells mix several mechanisms (SEI growth, lithium plating, loss of active material) that a single stretched exponential cannot separate. The knee detector is single-breakpoint.

Concrete extensions:

1. Rebuild from the raw matr.io `.mat` files to get full-life Q(n) curves; then `cyclesTo80Pct`, `Ret500`, the knee detector and the stretched-exponential fit all become meaningful.
2. Parse `policy` into `c1`, `soc_switch` and `c2` metadata fields so the scatter can use each axis of the design matrix.
3. Add a scatter colour key, then plot `cycle_life` vs `fadePerCycle` coloured by `cell_group`.
4. Export internal resistance and coulombic efficiency as additional per-cycle channels.
5. Replace the single-breakpoint knee detector with an information-criterion model selection over 1-, 2-, and 3-segment fits.

## How this maps back to materials

The isomorphism with the materials workflow:

- a **specimen** is a cell;
- a **tensile test** is the cell's discharge-capacity record;
- **yield stress** is an end-of-life scalar: `cycle_life` from metadata here, `cyclesTo80Pct` on full-life data; `initialCapacity` stands in for Young's modulus;
- **test temperature** in a materials campaign is the **charging protocol** here, the condition on the X-axis of the parameter scatter, and **batch** plays the role of material lot: a nuisance factor that turns out to matter more than the condition being swept.

The point worth pressing is that the parameter-vs-parameter plot is the universal research artefact. Load the series, reduce each one to a scalar, and the cross-section of the design matrix collapses to a two-axis picture that a supervisor can read in ten seconds. On this dataset that picture says "no" to the obvious hypothesis, and that is a result too. The analyzers differ between domains; the workflow does not.

## References

- Severson, K. A., Attia, P. M., Jin, N., Perkins, N., Jiang, B., Yang, Z., Chen, M. H., Aykol, M., Herring, P. K., Fraggedakis, D., Bazant, M. Z., Harris, S. J., Chueh, W. C. & Braatz, R. D. (2019). Data-driven prediction of battery cycle life before capacity degradation. *Nature Energy* 4, 383–391.
- Broussely, M., Biensan, P., Bonhomme, F., Blanchard, P., Herreyre, S., Nechev, K. & Staniewicz, R. J. (2005). Main aging mechanisms in Li ion batteries. *Journal of Power Sources* 146, 90–96.
- Dubarry, M. & Beck, D. (2020). Big data training data for artificial intelligence-based Li-ion diagnosis and prognosis. *Journal of Power Sources* 479, 228806.
- Attia, P. M., Bills, A., Planella, F. B., Dechent, P., dos Reis, G., Dubarry, M., Gasper, P., Gilchrist, R., Greenbank, S., Howey, D., Liu, O., Khoo, E., Preger, Y., Soudbakhsh, D., Sun, Y., Teo, J. M., Wang, X., Yang, F., Zhang, X.-G., Zhang, Y. & Viswanathan, V. (2022). Review — "Knees" in lithium-ion battery aging trajectories. *Journal of The Electrochemical Society* 169, 060517.
