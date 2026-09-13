# LiteLLM integration

NeuralFence v0.5 adds a working model execution adapter for LiteLLM v1.100.1. The browser-only Pages console still defaults to its local mock. The optional HTTP BFF can execute a governed model request through LiteLLM, with its result, token usage and gateway decisions displayed in the existing playground and traces.

## Source inside Neurofence

`vendor/litellm` is an ordinary tracked folder in this repository. A normal clone contains the backend code; no submodule initialization or separate LiteLLM checkout is required. It contains the Python SDK and proxy, the Rust source and supporting metadata from [DivyanKavdia/litellm](https://github.com/DivyanKavdia/litellm), pinned to v1.100.1 commit `1dba17b10ded12ad0021edb453ba2c54e4637928`.

The import contains 2,678 files. `source.manifest.json` records their upstream hashes, and `source.lock.json` records the current source digest, fork and dependency image. The root enterprise tree, upstream dashboard build and unrelated examples, tests and deployment scaffolding are excluded. Neurofence owns the console, policy controls and execution receipts. See [third-party notices](../../THIRD_PARTY_NOTICES.md).

The local Dockerfile builds the runtime from this folder. It reuses the tested upstream image by digest for installed dependencies, then the entry point explicitly imports the tracked Python package and verifies its content digest. It stops if the import resolves elsewhere or source content differs from the reviewed lock. The native Rust accelerator is not built or enabled in this Python runtime; its source is retained for later native builds. The dependency image can contain separately licensed enterprise packages; they are not activated by this integration.

```bash
npm run litellm:source
docker compose --env-file integrations/litellm/.env -f integrations/litellm/compose.yaml build
```

To edit the integrated backend, change files under `vendor/litellm`, review the diff, then run `npm run litellm:record`. This updates the content digest while preserving the original upstream hashes. Run the complete integration suite and commit the code and lock together.

For an upstream update, use `npm run litellm:diff -- --revision FULL_COMMIT_SHA` to produce `.runtime/litellm-upstream.patch`. Review it and apply it on a clean branch with `git apply --3way --directory=vendor/litellm .runtime/litellm-upstream.patch`; resolve conflicts explicitly and record the reviewed source. This path preserves local changes and keeps their original baseline. If there are no local patches, `npm run litellm:import -- --revision FULL_COMMIT_SHA` imports a fresh reviewed baseline. The importer refuses to overwrite local patches. Review the release metadata and dependency image when changing versions, then run the full tests.

The **Import reviewed LiteLLM source** GitHub workflow can import a reviewed commit into a new branch for a pull request. It does not update main. GitHub does not trigger another workflow from its own automation token, so push a reviewed follow-up commit before merging to run the normal CI checks on that branch.

GitHub Pages excludes backend source through `_config.yml`; it continues to publish the static Neurofence console.

## Run without provider keys

The fixture runs the imported LiteLLM proxy with a configured `mock_response`. Synthetic aliases and prices are explicitly marked as fixtures. It makes no external model calls.

```bash
npm ci
cp integrations/litellm/.env.example integrations/litellm/.env
# Set the same random local value for LITELLM_MASTER_KEY and LITELLM_API_KEY.
docker compose --env-file integrations/litellm/.env -f integrations/litellm/compose.yaml up --build --wait -d
npm run build
node --env-file=integrations/litellm/.env .runtime/mock-server.cjs
```

Open `http://127.0.0.1:8080/#gateway/playground`. The page identifies LiteLLM fixture mode. Run a safe request, sensitive-data request and injection attempt. The fixture response includes an identifier so the response redaction is visible. The LiteLLM key is supplied only by the server, never by the browser.

Stop the fixture with the same Compose command ending in `down`. The HTTP BFF defaults to loopback. These components remain an evaluation environment: demo role headers, provider onboarding, identity, keys and the other control-plane modules are still prototypes.

## Connect a real provider

1. Copy `live.example.yaml` to ignored `live.yaml`, choose an approved model/deployment and use environment references for its credentials. LiteLLM provider-specific configuration follows the upstream configuration reference.
2. Copy `bindings.fixture.json` to ignored `bindings.live.json`. Set `mode` to `litellm-live`, declare the exact allowed tenant/environment pairs, and map each NeuralFence provider ID to a LiteLLM alias, its actual deployment region and your reviewed INR token rates. The fixture rates are not market prices.
3. Run LiteLLM with the live config mounted instead of `fixture.yaml`, injecting the referenced provider variables into that container. Do not enable its request retries, fallback routes or cache independently of NeuralFence; those would change execution and billing semantics.
4. Point the local BFF at that server using `NF_MODEL_RUNTIME=litellm`, `NF_LITELLM_BINDINGS`, `LITELLM_URL` and `LITELLM_API_KEY`. The UI shows live execution and indicates that requests can incur charges.

Both request and response checks currently use prototype detectors. Do not expose this BFF as a production endpoint. Replace demo identity resolution and the control-plane simulator before enabling shared or production access. LiteLLM itself supports more endpoints, but only the governed text-chat path is integrated here; embeddings, Responses API, true SSE delivery, live provider discovery, virtual-key provisioning and MCP execution remain subsequent backend slices. Response text is buffered even if a legacy client supplies `streaming=true`.

## Usage, privacy and failures

The gateway reserves a conservative estimate based on UTF-8 prompt bytes, output limit and configured rates. Final cost uses LiteLLM's reported input/output tokens with those same configured INR rates; it is not a provider invoice or an automatic exchange-rate conversion. Unsupported/missing usage, redirects, timeouts and ambiguous failures hold the estimate and never trigger an automatic retry. Known request rejections release it. Inspect and reconcile held traces against provider records before issuing a new execution key. The prototype does not automatically reconcile real provider charges.

Execution receipts are persisted in the BFF's private data directory. Repeating a completed request returns its existing trace. With content retention disabled, the initial caller receives the inspected response but only metadata is saved, so a replay after restart returns a trace with content omitted. Interrupted receipts return `OUTCOME_UNKNOWN`. Receipt-bearing workspaces cannot be reset through the demo reset action; use a separate data directory to start a fresh evaluation.

The BFF is deliberately serial within one process. Its file store is not a production transaction log or multi-replica database. Before production, move reservations and receipts to the database, implement distributed quotas and reconciliation, use authenticated application credentials and replace example detectors with the real guardrail services.

## Terraform and cloud handoff

The AWS root now reserves an ECR repository and `litellm-executor` Secrets Manager slot. The optional platform resources are off by default. After the AWS root has been provisioned and reviewed separately, populate that secret with JSON containing `LITELLM_MASTER_KEY` and the provider environment values referenced by your YAML. The existing platform-input helper carries its ARN forward.

To include the private service in a later platform plan, set `enable_litellm=true`, provide `litellm_config_yaml`, and supply `litellm_secret_arn`. Build the image using the local Dockerfile, publish it to the reserved `litellm` ECR repository, and set `litellm_image` to the resulting immutable digest. Enabling the service requires that explicit image; Terraform has no default upstream runtime image. The service has a dedicated namespace, two replicas, a ClusterIP, nonroot containers, read-only filesystems and network policies. Only `app=ai-gateway` or `app=control-api` pods in the `neuralfence` namespace may reach port 4000. No public ingress is created. DNS and HTTPS egress are allowed; add your provider egress proxy restrictions and workload IAM roles where required.

Terraform copies the secret into a Kubernetes Secret, so its encrypted state must have restricted access. Provider-specific IAM, key rotation/rollout and an account-specific enabled plan still need deployment validation. The prototype BFF is not deployed by this Terraform. No cloud resources were provisioned for this integration.

## Verification

```bash
npm test
npm run litellm:source
# Against the Compose fixture, using its CI-only fixture key:
# LITELLM_MASTER_KEY=sk-neuralfence-ci-fixture-only-key docker compose -f integrations/litellm/compose.yaml up --wait -d
NF_TEST_LITELLM_URL=http://127.0.0.1:4000 NF_TEST_BROWSER=1 npm run test:litellm
```

The full stack test uses `sk-neuralfence-ci-fixture-only-key` solely as a synthetic local test credential. For a local Python environment containing the pinned proxy dependencies, set `NF_TEST_LITELLM_PYTHON` to its Python executable; the test starts and stops the imported source through `run.py`. `NF_TEST_LITELLM_BIN` remains available for testing a separately installed upstream proxy. GitHub CI builds the local Dockerfile, verifies that it loads the tracked source, and checks the mobile playground, guardrails, usage and replay behavior. Unit contract tests cover no-egress denials, residency, token accounting, redirects, errors, timeouts and durable interrupted receipts.
