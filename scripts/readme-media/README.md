# README media

Render code for the README GIF and the GitHub social preview images. Everything is captured from the live lab
at https://paramaterial.danielslater.dev, so rerun these after a visible UI change. Output goes to `out/` (ignored).

```shell
# README GIF: record the walkthrough, then encode (needs gifski: brew install gifski)
node scripts/readme-media/record.mjs B          # A whole app, B report only, C report + step captions
python3 scripts/readme-media/encode.py scripts/readme-media/out/frames-B lab.gif 12 960 1.4   # fps, width, speed

# Social preview (1280x640): capture the two charts, then render og.html for the lab and the package
node scripts/readme-media/charts.mjs
node scripts/readme-media/og.mjs p2 lab,pkg
```

The preview chosen on 2026-11-03 is `p2` (curves → proof stress vs temperature). GitHub has no API for it: upload
`out/og-p2-lab.png` under Settings → General → Social preview. The committed copy is `.github/social-preview.png`.
