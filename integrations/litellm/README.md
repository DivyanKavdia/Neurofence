# LiteLLM model runtime

This directory configures the LiteLLM backend tracked in `vendor/litellm`. The local Neurofence API calls it through `apps/api/src/providers/litellm.ts`; the console continues to use Neurofence pages, policy decisions, budgets and traces. Only text-model execution is connected. Browser-only demo mode does not start this runtime.

## Run the fixture

Use Node.js 24, Python 3.11+ for source checks, and Docker Compose. Run from the repository root:

```bash
npm ci
cp integrations/litellm/.env.example integrations/litellm/.env
# Set the same random local value for LITELLM_MASTER_KEY and LITELLM_API_KEY.
npm run litellm:source
docker compose --env-file integrations/litellm/.env -f integrations/litellm/compose.yaml up --build --wait -d
npm run build
node --env-file=integrations/litellm/.env .runtime/mock-server.cjs
```

Open `http://127.0.0.1:8080/#gateway/playground`. The page identifies fixture mode. Try a safe prompt, sensitive data and an injection attempt; inspect the response and trace. The actual LiteLLM proxy returns a configured fixture response with reported token usage. It does not call an external model, and its key stays on the server.

Stop the API with Ctrl+C and the container with:

```bash
docker compose --env-file integrations/litellm/.env -f integrations/litellm/compose.yaml down
```

## Files you will use

| File | Purpose |
| --- | --- |
| `.env.example` | Local API/runtime settings to copy into an ignored `.env` |
| `fixture.yaml`, `bindings.fixture.json` | Synthetic model response and explicit provider/scope/rate bindings |
| `live.example.yaml` | Starting point for operator-managed live model configuration |
| `compose.yaml`, `Dockerfile` | Local runtime built from tracked source using a pinned dependency image |
| `run.py` | Verify source integrity and imported module path, then start the Python proxy |
| `import.json`, `source.manifest.json`, `source.lock.json` | Import boundary, upstream file hashes and reviewed runtime/source pins |

## Connect a live model

1. Copy `live.example.yaml` to ignored `live.yaml`. Choose the approved deployment and use environment references for provider credentials.
2. Copy `bindings.fixture.json` to ignored `bindings.live.json`. Set `mode` to `litellm-live`, allow exact tenant/environment pairs, and map Neurofence provider IDs to LiteLLM aliases, deployment regions and reviewed INR token rates. Fixture rates are not market prices.
3. Start LiteLLM with `live.yaml` mounted instead of `fixture.yaml`, supplying the referenced provider environment variables. Keep its independent retries, fallback routes and cache disabled so Neurofence owns execution and billing decisions.
4. Start the API with `NF_MODEL_RUNTIME=litellm`, `NF_LITELLM_BINDINGS`, `LITELLM_URL` and `LITELLM_API_KEY` pointing to that configuration. The playground identifies live execution and possible charges.

The API derives aliases, rates, regions, endpoints and credentials from operator configuration. Client overrides do not select those values. Identity preview and detectors are still prototypes; connecting a provider does not make the local API a production service. Embeddings, Responses API, true SSE delivery, live discovery, provider key provisioning and MCP execution are not integrated. Text is buffered before response inspection, including when a legacy client supplies `streaming=true`.

## Understand costs and retries

Before external execution, Neurofence persists a pending receipt, trace and conservative reservation based on UTF-8 prompt bytes and the output limit. Final cost uses reported input/output tokens and the configured INR rates, not a provider invoice or automatic currency conversion.

A completed repeat returns the existing trace. Interrupted receipts return `OUTCOME_UNKNOWN`; timeouts, redirects, missing usage and ambiguous outcomes retain the estimate without an automatic retry. Known request rejections release it. Reconcile held traces against provider records before issuing another execution key. The prototype has no automatic real-charge reconciliation worker.

When content retention is off, the initial caller receives the inspected text, but persistence removes request/response content. A replay after restart therefore returns metadata. Receipt-bearing workspaces reject demo reset; select another `NF_MOCK_DATA` directory for a fresh evaluation. Production requires authenticated identities and transactional shared receipts, reservations and reconciliation. See [architecture](../../docs/architecture.md) and [API behavior](../../docs/api.md).

## Maintain the included source

A normal clone includes LiteLLM; there is no submodule setup. [The fork](https://github.com/DivyanKavdia/litellm) is the import source. The lock records the reviewed commit, release and dependency-image digest. The manifest preserves original upstream hashes. The import excludes the root enterprise tree, generated upstream dashboard and unrelated examples/tests/deployment scaffolding; see [third-party notices](../../THIRD_PARTY_NOTICES.md).

The runtime imports the tracked Python package and fails if its digest or import path differs from the reviewed source. The dependency image supplies installed packages. Rust source is retained, but this profile does not compile or enable the native extension. Separately licensed packages in the dependency image are not activated by this integration.

For a local patch, edit the relevant vendor files, review the diff, run `npm run litellm:record`, and commit the source and updated lock together. This retains the original upstream baseline. Run the complete runtime checks before merging.

For an upstream update:

```bash
# With no local patches, import a reviewed full commit SHA as a new baseline:
npm run litellm:import -- --revision FULL_COMMIT_SHA

# With local patches, generate and review the upstream delta instead:
npm run litellm:diff -- --revision FULL_COMMIT_SHA
git apply --3way --directory=vendor/litellm .runtime/litellm-upstream.patch
# Resolve conflicts, review the merged source, then:
npm run litellm:record
```

These are alternative update paths. The importer refuses to overwrite local patches. Review release metadata and the dependency-image pin when changing versions. The **Import reviewed LiteLLM source** workflow can create an import branch; it does not update main. A reviewed follow-up push is needed to trigger normal CI because GitHub does not chain workflow runs from its own automation token.

## Verify the runtime

`npm test` covers the API protocol fixture and console. The following additionally exercises the actual source-based runtime and mobile playground using a synthetic test credential:

```bash
npm run build
npm run litellm:source
LITELLM_MASTER_KEY=sk-neuralfence-ci-fixture-only-key docker compose -f integrations/litellm/compose.yaml up --build --wait -d
NF_TEST_LITELLM_URL=http://127.0.0.1:4000 NF_TEST_BROWSER=1 npm run test:litellm
LITELLM_MASTER_KEY=sk-neuralfence-ci-fixture-only-key docker compose -f integrations/litellm/compose.yaml down
```

Alternatively, set `NF_TEST_LITELLM_PYTHON` to a Python environment with the pinned proxy dependencies; the test starts the tracked source through `run.py`. `NF_TEST_LITELLM_BIN` tests a separately installed upstream executable. GitHub CI builds the local Dockerfile, verifies source origin and exercises request/response checks, token accounting, receipt replay, metadata retention and the mobile playground.

## Deploy later with Terraform

[The infrastructure guide](../../infra/README.md) covers the two provisioning roots. AWS reserves an ECR repository and a `litellm-executor` secret. The optional platform service defaults off. To enable it in a reviewed plan, provide `enable_litellm=true`, `litellm_config_yaml`, `litellm_secret_arn` and the immutable digest of the image built with this Dockerfile as `litellm_image`.

Populate the secret with `LITELLM_MASTER_KEY` and the provider variables referenced by the YAML. The service is private, has two replicas in a dedicated namespace, and permits only labeled gateway/control-api clients on port 4000. It uses nonroot containers, read-only filesystems and network policies. DNS/HTTPS egress is allowed; provider-specific egress restrictions and IAM remain deployment configuration.

Terraform materializes a Kubernetes Secret, so state access must be restricted and encrypted. Account-specific plans, key rotation/rollout and cluster startup require deployment validation. The prototype API is not deployed by this Terraform, and no cloud resources have been provisioned.
