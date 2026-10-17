# Скрипты

Генерация STL с булевыми операциями через [manifold-3d](https://www.npmjs.com/package/manifold-3d) (WASM) в Node 18+.

```bash
cd scripts
for f in manifold.js manifold.wasm; do curl -sSLO https://cdn.jsdelivr.net/npm/manifold-3d@3.5.3/$f; done
mkdir -p out
node build_stl_v5.mjs      # обод v5 (8 полусегментов), ступица, спицы, крышка -> out/
node shaft_adapter.mjs     # адаптер на вал Ø8 с лыской -> out/shaft_adapter_D8.stl
node plate_variantA.mjs    # контур пластины варианта А -> plate_polys.json
```

- `plate_variantA_outline.json` — контуры пластины (мм, плоскость XZ, первый контур внешний).
- `spoke_variantB_profile.json` — боковой профиль гнутой спицы варианта Б в координатах (r, y), мм.
- `render_preview.py` — превью STL через matplotlib.
