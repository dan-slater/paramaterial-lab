---
title: Materials — stress–strain case studies
slug: materials
---

# Materials — stress–strain case studies

Tensile and compression stress–strain curves are the canonical instance of the
paramaterial abstraction. Each test is a 1-D series (σ vs ε) plus a bag of
metadata (temperature, strain rate, lot, geometry), and the questions are
always the same: what single numbers summarise each curve, how do those vary
with the metadata, and does a constitutive model reproduce what we see? This
is the shape of problem paramaterial was built for — a DataSet of DataItems,
a sequence of per-item or per-group operations, and a final scatter of
extracted parameter against condition.

## Background — a century of constitutive modelling

The numbers that paramaterial extracts in this chapter are not arbitrary.
They are the parameters of constitutive laws that have been refined,
compared, and critiqued across a century of mechanical-metallurgy literature.
This section sets out the provenance of each model used downstream so that
the extracted scalars can be interpreted against their intended domain of
applicability.

**Cold plastic flow.** The oldest of the three power-law hardening forms is
due to Ludwik (1909), who proposed σ = σ_y + K·εⁿ to describe the
work-hardening of annealed metals past yield. The first term pins the yield
stress; the second captures the post-yield strengthening. Hollomon (1945),
working on steel, observed that for many engineering alloys the yield term
can be absorbed into the power-law prefactor without loss of fit quality,
yielding the simpler σ = K·εⁿ used throughout CS1 and in the web tool's
`fitRambergOsgood` routine. Swift (1952) in turn showed that materials with a
diffuse elastic–plastic transition are better described by a shifted form
σ = K·(ε₀ + ε)ⁿ, where ε₀ absorbs pre-yield elastic curvature and residual
strain. All three laws remain in routine use in sheet-metal forming and
structural analysis; the choice among them is a modelling decision, not a
physical one (Hertzberg 2012; Dieter 1986).

**Hot working.** Above roughly 0.4 T_m the hardening picture is complicated
by dynamic recovery and recrystallisation, and flow stress depends strongly
on strain rate as well as temperature. Zener and Hollomon (1944) proposed the
temperature-compensated strain rate Z = ε̇·exp(Q/RT) to collapse this
two-variable dependence onto a single axis, with Q an apparent activation
energy for deformation. Sellars and Tegart (1972) refined the approach for
hot compression of aluminium and steel, showing that a sinh flow-law
σ = (1/α)·sinh⁻¹[(Z/A)^(1/n)] fits a wider stress range than the simple
power law Z ∝ σⁿ. The log-linear ln σ ∝ ln Z fit used in CS3 and CS4 is the
power-law asymptote and is the form implemented in paramaterial's current
`apply_ZH_regression`. Modern textbook treatments (Dieter 1986 ch. 15;
Hertzberg 2012 ch. 5) situate both approaches in a common framework.

**Testing standards.** The tensile-test geometry and procedures assumed by
the Basic Usage and CS1 datasets follow ASTM E8/E8M-21, which prescribes
gauge-length-to-diameter ratio, crosshead rate, and elastic-modulus
determination for uniaxial tests on metallic materials. Deviations — plane
strain in CS2, plane-strain compression in CS4 — are noted per case study.

The chapter applies these models to the five case-study datasets to extract
cohort-level scalar parameters and their variation with lot, temperature,
test type, and strain rate.

The five case studies below are adapted from the companion notebooks in
`dan-slater/paramaterial-examples`. They share a workflow: (1) **prepare** —
load raw CSVs, reconcile headers, attach metadata from filename or spreadsheet;
(2) **visualise** — build an experimental matrix of specimen counts, colour
curves by temperature or lot; (3) **process** per curve — trim, find UTS and
fracture, detect upper/lower proportional limits (UPL/LPL), fit E, foot-correct,
compute proof or flow stress; (4) **screen** — emit a PDF with fitted-tangent
markers, re-ingest an annotated copy with rejection flags; (5) **aggregate** —
interpolate onto a common strain grid, compute mean ± std representative
curves per group, fit a model; (6) **compare** — scatter the extracted
parameter against temperature, strain rate, or specimen type. Tensile data is
a clean instance because per-curve operations are nearly purely local (foot
correction only uses elastic-region points) and group aggregation only needs
the strain key to align. The five studies differ in what varies on the
x-axis of the final scatter: lot, test-type, rate.

## Basic Usage — 154 tensile tests across 9 lots, 20–300 °C

### Provenance

154 tests from `dan_msc_basic_usage_0.1.0`, delivered as
`info/01 prepared info.xlsx` plus one CSV per specimen with columns `Strain`,
`Stress_MPa`. Nine lots (A–I), six nominal temperatures (20, 100, 150, 200,
250, 300 °C), two test types — uniaxial tension (`T`) and plane-strain
tension (`P`). All tests at 8.66 × 10⁻⁴ /s. The alloy is AA6061-T651. Source:
Aakash, Connors & Shields (2019), published on Mendeley Data
([doi:10.17632/rd6jm9tyb6.2](https://doi.org/10.17632/rd6jm9tyb6.2)).

### The research question

The introductory walkthrough. It exists to demonstrate every paramaterial
primitive end-to-end on a corpus large enough to exercise screening and
aggregation machinery but small enough to inspect every intermediate. The
scientific question is pedagogical: do the tool's extracted E, 0.2 % proof
stress, and UTS agree with a hand-curated reference (`aakash results.xlsx`)?

### Processing workflow

1. `pam.DataSet(info_path, data_dir)` loads info and CSVs keyed by `test_id`;
   `pam.check_formatting` verifies headers and absence of duplicates.
2. `ds.sort_by(['temperature', 'lot'])` and `ds.subset({'test_type': ['T']})`
   narrow to uniaxial tension.
3. `pam.experimental_matrix` heatmaps specimen counts vs (lot, temperature) to
   expose under-sampled cells.
4. `pam.find_UTS` and `pam.find_fracture_point` write `UTS_0/1`, `FP_0/1`.
5. Trim to `Strain < 0.01` for foot correction. `pam.find_upl_and_lpl(preload=36)`
   then `pam.correct_foot` shift each curve to the origin and record `E`.
6. `pam.make_screening_pdf` emits one subplot per test; the user annotates it
   and `pam.read_screening_pdf` re-ingests `reject`/`comment`. Eight tests are
   flagged (IDs 107, 112, 115, 121 at 200 °C; 137, 146, 152, 153 at 300 °C).
7. `pam.find_proof_stress(proof_strain=0.002, E_key='E')` sets `PS_0.002_0/1`.
8. `pam.make_representative_data` groups by `['temperature', 'test_type']`,
   interpolates, and records mean ± std curves plus aggregated scalars.
9. A `ModelSet` fits Ramberg–Osgood (`H`, `n`) with bounds (0, 1000) and
   (0.01, 0.8) to each representative curve.

### Key results

Six representative rows (one per temperature):

| T (°C) | E (MPa)  | 0.2 % PS (MPa) | UTS (MPa) | FP ε   |
|-------:|---------:|---------------:|----------:|-------:|
|    20  | 59,628   | 258.9          | 288.0     | 0.1079 |
|   100  | 59,198   | 244.5          | 261.1     | 0.1471 |
|   150  | 49,614   | 228.8          | 234.2     | 0.1787 |
|   200  | 49,614   | ~194           | 194.8     | 0.1530 |
|   250  | 40,590   | 141            | 141.9     | 0.1233 |
|   300  | 45,466   |  ~83           |  84.3     | 0.1691 |

UTS decays roughly linearly from 288 MPa at 20 °C to 84 MPa at 300 °C, a 71 %
reduction. 0.2 % proof stress tracks UTS closely — narrow UPL-to-UTS plateau,
consistent with n ≈ 0.1–0.14 (see CS1). The Aakash reference table reports
the same trends with typical σ deviations of 10–18 MPa, within one std of the
paramaterial means. The only large discrepancy is reference E at 200 °C
(5.2 GPa) vs paramaterial's 49.6 GPa — almost certainly a reference-file typo.

Ramberg–Osgood returns K = 217, 196, 177, 137, 97, 67 MPa for 20–300 °C
(notebook variable `H` in v0.1.0) with n = 0.137, 0.117, 0.102, 0.130, 0.102,
0.144 and fit error 5.8–19.4 MPa.

### Limitations

The info table does not record specimen geometry or alloy chemistry, so we
cannot convert to true stress beyond necking or attribute lot variation to
microstructure. `FP_0` includes the post-UTS machine compliance tail, so
cross-lab comparison of fracture strain is unreliable. The 0.2 % proof search
assumes a clean elastic modulus; at 200 °C two lots with outlier moduli
inflate the std band.

### Reproducing in the web tool

![0.2% proof stress vs temperature (basic-usage preset)](/docs-img/materials-scatter.png)

```
Preset: basic-usage
Blocks:
  Dataset picker (basic-usage)
  → Stress–strain (color by temperature)
  → Foot correction (preload = 36 MPa)
  → Properties table (UTS, 0.2 % PS, E)
  → Representative curves (group by temperature)
  → Parameter scatter (Y = 0.2% proof stress, X = temperature)
```

## CS1 — Ramberg–Osgood model fitting

### Provenance

76 uniaxial tests from `dan_msc_cs1_0.1.0`, a subset of the basic-usage corpus
restricted to lots A–E (PST and lots F–I dropped). Filenames encode test type,
temperature, lot, replicate, and three trailing IDs, e.g. `T_020_A_1_001_022_
03.csv`. All tests at 8.66 × 10⁻⁴ /s, `A_0 = 40.32 mm`, `h_0 = 3.175 mm`. Same
six-point temperature grid as basic-usage. Source: Aakash, Connors & Shields
(2019), the same dataset as basic-usage.

### The research question

Does Ramberg–Osgood (σ = E·ε for ε ≤ σ_y/E, σ = K·ε^n beyond) reproduce the
curves across five lots and six temperatures, and do (K, n) vary
systematically with temperature? This is the template for fitting a
constitutive model and pushing the parameter-vs-temperature comparison.

### Processing workflow

1. Rebuild info from filenames (`filename.split('_')[:4]`) for reproducibility
   without a pre-curated spreadsheet. Drop PST and lots F–I; rename `T → UT`.
2. `pam.copy_data_and_rename_by_test_id` renames CSVs into `test_ID_###`.
3. Convert strain to percent. `find_uts_and_failure` apply function writes
   `UTS_0/1`, `FP_0`.
4. Trim to `Strain < 1` %. `pam.find_upl_and_lpl(preload=36)` then
   `pam.correct_foot`.
5. Screening PDF round-trip; five tests flagged (IDs 002, 015, 018 at 200 °C;
   041, 049 at 300 °C) and removed.
6. `pam.find_proof_stress(proof_strain=0.2)` — 0.2 (percent) here vs 0.002
   (fractional) in basic-usage, matching the strain-in-percent convention.
7. `make_representative_data` grouped both by `['lot', 'temperature',
   'test_type']` (per-lot) and by `['temperature', 'test_type']` (lot-pooled).
8. Ramberg–Osgood `ModelSet` fit with bounds (0, 1000) on K and (0.01, 0.8)
   on n, `scipy_func='minimize'`, `sample_size=40` to avoid over-weighting the
   dense post-yield tail.

### Key results

Per-temperature pooled fit (6 repres curves, 76 tests, lots A–E):

| T (°C) | K (MPa) | n       | fit error (MPa) |
|-------:|--------:|--------:|----------------:|
|    20  | 106.7   | 0.0894  | 22.6            |
|   100  |  64.9   | 0.0829  |  9.3            |
|   150  |  73.9   | 0.0949  | 30.2            |
|   200  |  19.6   | 0.1171  |  4.5            |
|   250  |  81.2   | 0.0869  | 27.6            |
|   300  |  86.6   | 0.1025  |  4.8            |

K is noisy at the single-temperature level — the pooled fits do not trace a
monotonic K(T) curve, and the 200 °C K = 19.6 MPa is an outlier tied to the
three 200 °C tests flagged in foot-correction screening. Re-running the fit
per (temperature, lot) gives more stable K values (notebook figs 5.2, 5.4),
so the pooled residual is dominated by lot variation, not random noise. n
lies in the band 0.04–0.14 across all (temperature, lot) pairs, consistent
with a lightly work-hardening aluminium alloy.

### Limitations

Ramberg–Osgood has no temperature term; any apparent (K, n) temperature trend
is descriptive only. The fit uses `E` and `UPL_1` as fixed variables, so a
biased foot correction propagates into biased (K, n). `sample_size=40`
downsamples the dense near-yield region where curvature is largest; an
unweighted log-space OLS (as in the web tool's `fitRambergOsgood`) gives
different residuals. Five rejected tests and dropped lots F–I thin the 200
and 300 °C aggregates.

### Reproducing in the web tool

```
Preset: cs1
Blocks:
  Dataset picker (cs1)
  → Stress–strain (color by lot, subplot by temperature)
  → Foot correction (preload = 36 MPa)
  → Ramberg–Osgood (per test, proofStrain = 0.002)
  → Parameter scatter (Y = K, X = temperature, color by lot)
  → Parameter scatter (Y = n, X = temperature)
```

## CS2 — Uniaxial vs plane-strain tension

### Provenance

74 tests from `dan_msc_cs2_0.1.0`, restricted to lots F–I and both test types
(`UT` and `PST`). Same rate (8.66 × 10⁻⁴ /s). Temperatures span 20, 150, 200,
250, 300 °C — 100 °C is silently dropped (notebook comment `#??`).
Geometry is asymmetric: `A_0 = 40.32 mm` for UT, 20.16 mm for PST, thickness
3.175 mm. Source: Aakash, Connors & Shields (2019), the same dataset as
basic-usage.

### The research question

How does a constraint change (plane-strain vs uniaxial) shift extracted yield,
UTS, and Ramberg–Osgood strength with temperature? The canonical
two-population comparison: identical pipeline on two test-type subsets,
overlaid on a parameter-vs-temperature axis.

### Processing workflow

1. Rebuild info from filenames, subset to lots F–I, split `T → UT`, `P → PST`.
2. `pam.experimental_matrix` emitted once per test type side-by-side: UT has
   ~4 specimens per (lot, temp) cell, PST up to 12.
3. `make_strain_percent`, `find_uts`, `find_fracture` apply functions.
4. Trim to `Strain < 3` % (PST reaches higher strains than CS1 UT).
5. `find_upl_and_lpl(preload=36)` + `correct_foot`. The notebook does not
   re-derive the preload threshold for PST specimens.
6. `make_representative_data` grouped by `['lot', 'temperature',
   'test_type', 'rate']` and by `['temperature', 'test_type']`.
7. Ramberg–Osgood with bounds (0, 1000) on K and (0.1, 0.8) on n — n-floor
   raised from CS1 to suppress unphysical exponents on PST's shorter elastic
   region.
8. `make_representative_info` pools across lots for the final
   test-type × temperature table (figs 5.8–5.9).

### Key results

> **Units note.** The CS2 notebook rescales strain into percent
> (`Strain *= 100`) before fitting the elastic slope, so the raw `E` column
> in the info table is in MPa-per-percent-strain — numerically **one-tenth
> of GPa**. The notebook's `data['E'] = data['E'] / 10` step in fig 5.8
> converts those raw values to physical GPa; the factor of 10 is the
> correct conversion, not a bug (strain is rescaled by ×100, so the
> numerical E in the raw table is 1/100 of E in MPa and hence 1/10 of E in
> GPa). The table below quotes both the raw notebook number (left) and the
> physical SI value (right, GPa) so the reader is not left to reconstruct
> units from prose.

Representative elastic modulus and proportional-limit stress by
(temperature, test type), pooled across lots F–I:

| T (°C) | UT E_raw (MPa/%) | UT E (GPa) | PST E_raw (MPa/%) | PST E (GPa) | UT σ_UPL (MPa) | PST σ_UPL (MPa) |
|-------:|-----------------:|-----------:|------------------:|------------:|---------------:|----------------:|
|    20  | 588.9            |  58.9      | 543.2             |  54.3       | 169.5          | 194.1           |
|   150  | 477.2            |  47.7      | 394.1             |  39.4       | 163.3          | 186.9           |
|   200  | 396.4            |  39.6      | 396.3             |  39.6       | 157.1          | 185.3           |
|   250  | 417.2            |  41.7      | 367.4             |  36.7       |  84.5          |  93.3           |
|   300  | 302.6            |  30.3      | 247.6             |  24.8       |  68.5          |  68.8           |

UT moduli at 20–300 °C (58.9 → 30.3 GPa) agree with the basic-usage corpus
at the same temperatures (~59.6 GPa at 20 °C, 45.5 GPa at 300 °C) within
one pooled standard deviation — confirming the `×100 / ÷10` chain is
internally consistent. PST modulus sits 5–18 % below UT modulus across
temperatures; the notebook attributes the gap to the shorter elastic region
available for the linear fit on the 20.16 mm PST gauge vs 40.32 mm for UT.

The σ_UPL and σ_UTS trends are the comparison this case study exists to make:
PST σ_UTS exceeds UT σ_UTS at every temperature, consistent with Levy–Mises
plane-strain elevation of 2/√3 ≈ 1.155 — but the notebook does not quote a
specific ratio and per-temperature std bars overlap the effect at the hotter
temperatures.

### Limitations

100 °C is silently dropped. PST uses the same 36 MPa preload as UT despite a
half-length gauge; `find_upl_and_lpl` thresholds on stress, so this is
defensible, but a geometry-specific cutoff would be cleaner. Ramberg–Osgood
has no plane-strain correction — comparing fitted K between UT and PST
without an explicit 2/√3 factor double-counts the constraint effect.

### Reproducing in the web tool

```
Preset: cs2
Blocks:
  Dataset picker (cs2)
  → Stress–strain (subplot by test_type, color by temperature)
  → Foot correction (preload = 36 MPa)
  → Representative curves (group by temperature + test_type)
  → Parameter scatter (Y = UTS, X = temperature, color by test_type)
  → Ramberg–Osgood (per test)
  → Parameter scatter (Y = K, X = temperature, color by test_type)
```

## CS3 — Hot uniaxial compression, Zener–Hollomon regression

### Provenance

70 hot uniaxial compression (`UC`) tests from `dan_msc_cs3_0.1.0`, run on the
Gleeble 3800 thermomechanical simulator at the Centre for Materials Engineering
(CME), University of Cape Town. The alloy is AA3104 in three states: as-cast
(`AC`), and homogenised at 560 °C (`H560`) and 580 °C (`H580`), at six temperatures (300, 330, 360, 400, 450,
500 °C) and two rates (1 and 10 /s). Cylindrical specimens, `L_0 = 15 mm`,
`D_0 = 10 mm`. Data files are 12-column (time, force, jaw, thermocouple TC1,
σ, ε, plus machine diagnostics). Source: Shanle Baron (2018), a Hulamin
progress report from UCT; test IDs `baron_test_###` refer to that report.

### The research question

Can a single activation-energy law — the Zener–Hollomon parameter
Z = ε̇·exp(Q/RT) — regressed against flow stress at ε = 0.3, collapse all
materials and rates onto one master curve? And if not, do residuals cluster
by material or by rate, revealing which variable is under-modelled?

### Processing workflow

1. `check_column_headers` and `check_for_duplicate_files` on the raw
   directory; 12 data columns per test. Load into DataSet, sort by temperature.
2. `experimental_matrix` emitted once per material (3 side-by-side heatmaps).
3. Trim: drop machine-diagnostic columns, filter rows with Δt < 0.02 s
   (removes dwell segments), cut at max force (removes unloading tail).
4. `pam.calculate_strain_rate(time_key='Time(sec)')` writes `Strain_Rate` as
   a numerical derivative; measured rate ≈ nominal.
5. `pam.find_flow_stress_values(flow_strain=0.3)` reads σ, actual T (from TC1
   thermocouple, a few °C offset from nominal), actual ε̇ at the target.
6. `make_representative_data` grouped by `['temperature', 'material', 'rate']`
   across the 6 × 3 × 2 = 36 cells.
7. `Q_activation = 155000` J/mol (assumed constant), `flow_temp(K) = flow_TC1
   + 273.15`, then `pam.calculate_ZH_parameter` writes Z per test.
8. `pam.apply_ZH_regression` fits ln σ = a·lnZ + b with `group_by='material'`
   and separately `group_by='rate'` to see which grouping is tighter.
9. `pam.make_quality_matrix` scores each (temperature, rate) cell by
   deviation from the ZH line (red = 80 %, green = 100 %).

### Key results

The ZH master-curve plot (fig 5.13) overlays all 36 cells of the (material,
temperature, rate) grid on the ln σ–lnZ plane. Per-material regression gives
three lines; per-rate gives two. The notebook does not print numerical
slopes, but the conformance matrix (vmin=80, vmax=100) shows per-material
regression yielding tighter clusters than per-rate. The case study's reading:
155 kJ/mol is reasonably material-independent within this alloy family, and
rate is the stronger discriminant; pooling AC + H560 + H580 under a single Q
is defensible to ~10 % residual.

Flow stress at ε = 0.3 declines with temperature at both rates. From fig 5.11,
the 1 /s curve spans a ~4× ratio between 300 and 500 °C; the 10 /s curve sits
above 1 /s at every temperature by ~1.4–1.7× (consistent with strain-rate
sensitivity m ≈ 0.1–0.15). Per-cell numbers are written to `s1_table.tex`
and `s10_table.tex`.

### Limitations

Q is fixed at 155 kJ/mol. If true Q varies between AC / H560 / H580, the lnZ
axis is miscalibrated per group and the per-material conformance improvement
is partly an artefact of group-specific intercepts absorbing the Q error.
Two rates means m is a two-point log slope, sensitive to rate-measurement
accuracy. ε = 0.3 is near steady-state at ≥400 °C but still in the hardening
region at 300 °C — the target is not uniformly "steady state".

### Reproducing in the web tool

```
Preset: cs3
Blocks:
  Dataset picker (cs3)
  → Stress–strain (subplot by rate, color by temperature)
  → Representative curves (group by material + rate + temperature)
  → Zener–Hollomon (Q = 155000 J/mol, flow strain = 0.3)
  → Parameter scatter (Y = flow_stress, X = temperature, color by rate)
  → Parameter scatter (Y = lnZ, X = ln(flow_stress), color by material)
```

## CS4 — Plane-strain compression at high strain rates

### Provenance

40 plane-strain compression (PSC) tests from `dan_msc_cs4_0.1.0`, run on the
same Gleeble 3800 at CME as CS3. Single material `TB` (AA3104 transfer bar) at three
temperatures (300, 350, 400 °C) and three rates (10, 30, 100 /s) — an order
of magnitude faster than CS3. Two specimen sizes: `PSC` (smaller) and
`PSC*` (larger, `b_0 = 60 mm`, `L_0 = 10 mm`, `h_0 = 60 mm`, `w = 12.5 mm`).
Friction/geometry corrections Ascale = Bscale = 0.866 recorded in the info
table. Source: Hyde (2015), an MSc thesis at UCT, which also defines the two
specimen geometries.

### The research question

PSC is a constrained test: nominally plane-strain but perturbed by friction
and specimen-size effects. Does the ZH master curve still collapse the data
when the grouping variable is specimen size rather than material? And are the
two specimen classes statistically distinguishable after the friction
correction?

### Processing workflow

1. `check_column_headers` with `exception_headers` to tolerate missing TC4 /
   stroke / wedge columns (hardware variation between runs). Load, sort by
   `['test type', 'temperature']`.
2. Experimental matrix per test type (PSC vs PSC*), each a 3 × 3 heatmap.
3. Trim: drop machine-diagnostic columns (conditional), filter Δt < 0.02 s,
   cut at `Strain < 1.2`.
4. `pam.calculate_strain_rate`, then `find_flow_stress_values(flow_strain=
   (0.8, 0.9))` — a range rather than a point, so σ is averaged over the
   0.8–0.9 strain window near steady state. Rate and TC1 are averaged
   similarly.
5. `make_representative_data` grouped by `['temperature', 'test type', 'rate']`.
6. Same ZH machinery as CS3: Q = 155 kJ/mol, `flow_temp(K) = TC1 + 273.15`,
   then `apply_ZH_regression` grouped alternately by `test type` and by `rate`.
7. Per-rate tables `s10_table.tex`, `s30_table.tex`, `s100_table.tex`.

### Key results

Figure 5.16 plots flow stress vs temperature at each rate, with PSC and PSC*
overlaid. Qualitatively, PSC and PSC* tracks overlap within error bars at
300 °C and diverge at 400 °C with PSC* running higher — consistent with
specimen-size-dependent friction. Flow stress at (10 /s, 300 °C) is the
highest point; at (100 /s, 400 °C) the lowest. The notebook does not print
the numerical differences.

ZH regression grouped by `test type` (fig 5.17) gives two lines, one per
specimen class. Conformance matrices (vmin=85, vmax=100) put most cells in
the 90–100 % band — tighter than CS3's 80 % floor, suggesting single-material
PSC data at high rate is more internally consistent than the three-material
CS3 set.

### Limitations

Single material means the ZH exercise demonstrates collapse across rate and
temperature but not chemistry — it cannot confirm TB's Q is 155 kJ/mol. The
friction constants (Ascale, Bscale = 0.866) are applied upstream of the
paramaterial pipeline and not revisited; a sensitivity on these would shift
absolute flow stress by a few percent. The 0.8–0.9 strain window is a design
choice; a different window shifts the fitted slope and intercept.

### Reproducing in the web tool

```
Preset: cs4
Blocks:
  Dataset picker (cs4)
  → Stress–strain (subplot by rate, color by temperature)
  → Representative curves (group by test_type + rate + temperature)
  → Zener–Hollomon (Q = 155000 J/mol, flow strain window = 0.8–0.9)
  → Parameter scatter (Y = flow_stress, X = temperature, color by test_type)
  → Parameter scatter (Y = flow_stress, X = rate, color by test_type)
```

## Cross-study synthesis

The five case studies cover a surprisingly broad slice of mechanical
testing — cold tensile behaviour across 9 lots (Basic Usage), a constitutive
fit of Ramberg–Osgood parameters against temperature (CS1), a
two-population contrast of uniaxial vs plane-strain tension (CS2), hot
uniaxial compression with a Zener–Hollomon collapse across three alloy
tempers and two rates (CS3), and high-rate plane-strain compression
contrasting two specimen sizes under the same ZH machinery (CS4). What is
common across all five is the pipeline itself: the same `DataSet →
apply(per-curve) → screen → make_representative_data → ModelSet.fit_to →
scatter` graph runs every time. The primitives (`find_upl_and_lpl`,
`correct_foot`, `find_UTS`, `find_proof_stress`, `find_flow_stress_values`,
`calculate_ZH_parameter`, `apply_ZH_regression`) are composed in slightly
different orders, but the representative-curve aggregation is always the
bridge between per-test scalars and group-level comparison. What varies is
the *metadata axis* that ends up as X on the final parameter scatter —
`lot` in Basic Usage and the CS1 per-lot sub-fit, `test_type` in CS2,
`material` or `rate` in CS3, `test_type` or `rate` in CS4. This is the
claim that justifies housing five nominally different experiments in one
chapter: they are the same analysis with different `group_by_keys`. The
web tool's Parameter-scatter block is the UI manifestation of that single
axis of freedom.

## Limitations

Four chapter-level caveats carry across the case studies:

- **Incomplete provenance.** None of the five datasets cite an originating
  paper. Alloy identity, specimen geometry (where it is not encoded in
  filenames), thermocouple calibration, and friction-correction sources are
  taken from notebook comments or inferred from filenames. Cross-lab
  reproduction of absolute stress values is therefore not defensible.
- **CS2 units discipline.** The CS2 notebook preserves strain in percent,
  producing an `E` column in MPa-per-percent. The convention is internally
  consistent but a known stumbling block for first-time readers; see the
  boxed note in the CS2 Key Results section.
- **Fracture-strain compliance.** `FP_0` in Basic Usage and CS1 includes
  the post-UTS machine-compliance tail, so the fracture-strain values in
  those tables are not comparable across labs or test rigs.
- **Preload threshold.** The whole pipeline depends on
  `pam.find_upl_and_lpl(preload=36)`'s 36 MPa preload being appropriate
  for the alloy. For the CS2 PST specimens, the same 36 MPa threshold is
  used despite a halved gauge length; for a stiffer or weaker material the
  preload must be re-derived. This is the single assumption that
  propagates into every downstream property (E, σ_UPL, σ_UTS, σ_0.2, K, n).

## Where paramaterial must generalise next

The v0.2 brief for the materials chapter was direct: constitutive models
should be selectable from a library, not hard-coded. The tool currently
fails that brief. Hollomon hardening is baked into `fitRambergOsgood` in
`src/lib/processing.ts`, and the Zener–Hollomon regression assumes a
single power-law form. A user who wants to screen Ludwik
(`σ = σ_y + K·εⁿ`) or Swift (`σ = K·(ε₀ + ε)ⁿ`) against the same plastic
window has to edit TypeScript. The preference cannot be expressed from the
UI, which means the "research tool" framing breaks down the moment the
research question turns to model selection itself.

The concrete extension is a `ModelFitBlock`: a block component whose first
control is a model-selection dropdown populated from a registry, which
fits the selected model per-test and renders a comparison table of R²,
AIC, and BIC across the models in that registry. The API is small:

```ts
export interface ConstitutiveModel {
  name: string;                 // 'Hollomon', 'Ludwik', 'Swift'
  paramNames: string[];         // ['K', 'n'] or ['sigma_y', 'K', 'n'] etc.
  fit(
    curve: Curve,
    plasticWindow: { start: number; end: number }
  ): { params: number[]; rSquared: number; aic: number; bic: number };
  predict(strain: number, params: number[]): number;
}

export const HARDENING_MODELS: ConstitutiveModel[] = [hollomon, ludwik, swift];
```

The implementation lift is medium: one block component
(`ModelFitBlock.svelte`, ~150 lines), one new module
(`src/lib/models/hardening.ts`, three model-object implementations,
~200 lines), and a comparison-table renderer (~50 lines of Svelte). No
schema change is required — the registry is pure code, and per-test fit
results attach to existing curve records. This is the single extension
that would let a materials scientist screen constitutive models in the
browser without editing source, which is the minimum bar for the
"research tool" label.

The finance chapter proposes multi-covariate regression against yield
curves, the climate chapter proposes spatial indexing over
station–station grids, and the battery work (held back until the v0.4
rebuild) needs time-varying metadata for cycle-by-cycle provenance. The materials proposal above is
the fourth instance of the same diagnosis. The schema and UI are bound
too tightly to the single-curve abstraction that was natural for tensile
testing. Each domain extension loosens one axis of that binding —
covariates, space, time, and here, model family — and none of them is
expressible without touching source today.

## References

- Ramberg, W. & Osgood, W. R. (1943). *Description of stress–strain curves
  by three parameters.* NACA Technical Note 902. National Advisory
  Committee for Aeronautics, Washington, D.C.
- Zener, C. & Hollomon, J. H. (1944). Effect of strain rate upon plastic
  flow of steel. *Journal of Applied Physics* 15, 22–32.
- Aakash, B., Connors, J. & Shields, M. D. (2019). Stress–strain data for
  aluminum 6061-T651 from 9 lots at 6 temperatures under uniaxial and plane
  strain tension. *Data in Brief* 25, 104085.
  [doi:10.1016/j.dib.2019.104085](https://doi.org/10.1016/j.dib.2019.104085).
  Data: Mendeley Data,
  [doi:10.17632/rd6jm9tyb6.2](https://doi.org/10.17632/rd6jm9tyb6.2).
  Source of basic-usage, CS1 and CS2. The Basic Usage cross-check compares
  against this paper's reported properties, redistributed as
  `aakash results.xlsx` in `dan-slater/paramaterial-examples`.
- Shanle Baron, S. G. (2018). *Hulamin Progress Report.* Technical report,
  University of Cape Town. Source of the CS3 uniaxial compression data.
- Hyde, C. K. (2015). *Critical analysis of simulated thermomechanical
  processing of aluminium can body stock.* MSc thesis, University of Cape
  Town. [hdl:11427/15749](http://hdl.handle.net/11427/15749). Source of the
  CS4 plane-strain compression data and specimen geometries.
- Slater, D. (2023). *Development of open-source software for repeatable
  processing of mechanical test data.* MSc thesis, University of Cape Town.
  [hdl:11427/39860](http://hdl.handle.net/11427/39860). Companion notebooks
  at `github.com/dan-slater/paramaterial-examples`.
