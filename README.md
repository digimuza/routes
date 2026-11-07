# Maršrutai – kurjerių maršrutų demo su Google Route Optimization API

Paketai (su prioritetu ir pristatymo langu) paskirstomi 10 kurjerių, sudaromas pristatymo
eiliškumas, sugeneruojamas `plan.json`, suvestinė ir PDF kiekvienam kurjeriui. Specifikacija: [SPEC.md](SPEC.md).

## Paleidimas

Reikia Node.js 20+.

```sh
npm install
npm run demo                    # data/normal.json per realų Google Route Optimization API
npm run demo -- overload        # data/overload.json: per daug paketų, dalis 3 prioriteto lieka nepristatyti
npm run demo -- --mock          # lokalus algoritmas, be GCP paskyros
npm run demo -- kelias/iki/dataset.json --out kitas/katalogas
npm run dev                     # dashboard (Vite), skaito out/plan.json
```

Rezultatai `out/` kataloge:

- `plan.json` – planas (`Plan` tipas iš `packages/shared`), vienintelė sąsaja su dashboard'u ir PDF;
- `summary.md` – suvestinė per kurjerius ir nepristatyti paketai;
- `courier-NN-vardas.pdf` – kurjerio maršrutas (kai prijungtas PDF modulis).

Duomenų rinkinius galima pergeneruoti: `npm run gen-data` (deterministinis seed).

## GCP nustatymas (realiam API)

1. Projektas su įjungtu billing (numatytas `marsrutai-digimuza`):
   ```sh
   gcloud config set project marsrutai-digimuza
   gcloud services enable routeoptimization.googleapis.com
   ```
2. Vartotojui reikia teisės `roles/routeoptimization.editor` (arba Owner/Editor).
3. Prisijungimas (Application Default Credentials):
   ```sh
   gcloud auth application-default login
   gcloud auth application-default set-quota-project marsrutai-digimuza
   ```
   Jei ADC nėra, CLI bando `gcloud auth print-access-token`.
4. Kitas projektas: `GOOGLE_CLOUD_PROJECT=<projektas> npm run demo` (žr. `.env.example`).

Vienas `npm run demo` = vienas `optimizeTours` kreipinys (~70 siuntų). API mokamas už siuntą,
todėl demo metu verta naudoti iš anksto sugeneruotą `out/`. Be kredencialų naudokite `--mock`.

## Struktūra

| Kelias | Paskirtis |
|---|---|
| `packages/shared` | `Dataset`, `Plan`, `Optimizer` tipai ir zod schemos |
| `packages/cli/src/index.ts` | CLI: įkėlimas → optimizavimas → `plan.json`, `summary.md`, PDF |
| `packages/cli/src/api` | Google Route Optimization API (REST `optimizeTours`) |
| `packages/cli/src/mock` | lokalus godus algoritmas (`--mock`) |
| `packages/cli/src/load.ts` | duomenų nuskaitymas ir validacija |
| `packages/cli/scripts` | `gen-data`, `try-api`, `try-mock` |
| `data/` | `normal.json`, `overload.json` |

Testai ir tipų patikra: `npm test -w @marsrutai/cli`, `npm run typecheck`.
