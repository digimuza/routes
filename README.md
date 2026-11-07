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
npm run dev                     # serveris (:8787) + dashboard (Vite) kartu – interaktyvus redaktorius
npm run dev:server              # tik serveris (PORT=8787 numatytai)
npm run dev:web                 # tik dashboard
npm test                        # visi testai (cli + server)
```

Rezultatai `out/` kataloge:

- `plan.json` – planas (`Plan` tipas iš `packages/shared`), vienintelė sąsaja su dashboard'u ir PDF;
- `summary.md` – suvestinė per kurjerius ir nepristatyti paketai;
- `courier-NN-vardas.pdf` – kurjerio maršrutas.

Duomenų rinkinius galima pergeneruoti: `npm run gen-data` (seed 42) arba `npm run gen-data -- --seed 7`.

## Scenarijų redaktorius ir lokalus serveris

`npm run dev` paleidžia `@marsrutai/server` (http://localhost:8787) ir Vite dashboard'ą; Vite proxy'ina
`/api` ir `/out` į serverį. Dashboard'e pasirenkamas miestas (Vilnius / Kaunas), sugeneruojami arba
žemėlapyje pridedami paketai, redaguojami kurjeriai, „Sudaryti maršrutus" (Google API arba Mock).

| Metodas | Kelias | Aprašas |
|---|---|---|
| GET | `/api/cities` | miestai: centras, ribos, numatytasis sandėlis |
| GET | `/api/scenario?city=kaunas` | išsaugotas scenarijus (`Dataset`); jei nėra – tuščias su 10 kurjerių (neįrašomas) |
| PUT | `/api/scenario?city=kaunas` | validuoja ir įrašo į `data/scenarios/<miestas>.json` |
| POST | `/api/generate` | `{city, count, mix:{p1,p2,p3}, seed?, existingIds?}` → `{packages}` (nieko neįrašo) |
| POST | `/api/optimize` | `{city, mode:"api"\|"mock"}` → `{plan, pdfs, planUrl, zipUrl, durationMs}` |
| GET | `/api/plan?city=kaunas` | paskutinis optimizavimo rezultatas arba 404 |
| GET | `/api/pdfs.zip?city=kaunas` | visi miesto PDF vienu ZIP |
| GET | `/out/**` | `out/<miestas>/plan.json`, `summary.md`, `courier-NN-vardas.pdf`, `pdfs.zip` |

Kontraktas (zod schemos): `packages/shared/src/api.ts`. Klaidos – `{error, details?}` lietuviškai;
validacijos klaidos turi `details.issues`, Google API klaidos grąžinamos su HTTP 502 ir `details.hint`.
`/api/optimize` naudoja *išsaugotą* scenarijų, todėl prieš jį reikia `PUT /api/scenario`.

```sh
curl localhost:8787/api/cities
curl -X POST localhost:8787/api/generate -H 'content-type: application/json' \
  -d '{"city":"kaunas","count":30,"mix":{"p1":20,"p2":45,"p3":35}}'
curl -X POST localhost:8787/api/optimize -H 'content-type: application/json' -d '{"city":"kaunas","mode":"mock"}'
```

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
| `packages/shared` | `Dataset`, `Plan`, `Optimizer` tipai, zod schemos, serverio API kontraktas |
| `packages/cli/src/index.ts` | CLI: įkėlimas → optimizavimas → `plan.json`, `summary.md`, PDF |
| `packages/cli/src/api` | Google Route Optimization API (REST `optimizeTours`) |
| `packages/cli/src/mock` | lokalus godus algoritmas (`--mock`) |
| `packages/cli/src/pdf` | PDF kiekvienam kurjeriui |
| `packages/cli/src/generate` | generatorius: miestai, kuruoti Vilniaus ir Kauno adresai, kurjeriai |
| `packages/cli/src/load.ts` | duomenų nuskaitymas ir validacija |
| `packages/cli/scripts` | `gen-data`, `try-api`, `try-mock`, `try-pdf` |
| `packages/server` | lokalus HTTP serveris (hono) scenarijų redaktoriui |
| `packages/dashboard` | Vite + React + Leaflet dashboard |
| `data/` | `normal.json`, `overload.json`; `scenarios/` (gitignore) |

Testai ir tipų patikra: `npm test`, `npm run typecheck`.
