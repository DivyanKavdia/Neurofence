# LiteLLM integration

NeuralFence v0.5 adds a working model execution adapter for LiteLLM v1.100.1. The browser-only Pages console still defaults to its local mock. The optional HTTP BFF can execute a governed model request through LiteLLM, with its result, token usage and gateway decisions displayed in the existing playground and traces.

## Source and fork

`vendor/litellm` uses [DivyanKavdia/litellm](https://github.com/DivyanKavdia/litellm), verified as a fork of `BerriAI/litellm`, and pins the tested v1.100.1 commit `1dba17b10ded12ad0021edb453ba2c54e4637928`. That exact commit was successfully fetched from the fork on 13 September 2026. `source.lock.json` records the fork, upstream repository, release and image digest.

To obtain the linked source and verify its pin, run from this repository:

```bash
git submodule sync -- vendor/litellm
git submodule update --init --checkout --recursive vendor/litellm
npm run litellm:source
```

To switch to another fork, run `npm run litellm:source -- --use OWNER/litellm`; the command verifies its parent repository and fetches the pinned commit before linking it. If you need to create another fork, `npm run litellm:fork` supports `GH_TOKEN` supplied through your local credential environment and authorized to create it. Tokens never belong in this repository or the frontend configuration. Review and commit `.gitmodules` and `source.lock.json` after a source switch succeeds.

The default runtime still uses the tested upstream v1.100.1 image by digest. Linking the fork does not rebuild that image or deploy fork changes. Build the checked-out source and select its resulting image as described below when fork-specific changes are ready.

To build the actual checked-out fork, expand a sparse checkout if necessary and use its upstream Dockerfile:

```bash
git -C vendor/litellm sparse-checkout disable
docker build -t neuralfence-litellm:1.100.1 vendor/litellm
```

Set `NF_LITELLM_IMAGE=neuralfence-litellm:1.100.1` when running the local Compose profile. For cloud deployment, publish that image to the reserved `litellm` ECR repository and set `litellm_image` to its immutable registry digest. Upstream Docker builds include their own UI and dependency build stages and can take substantial time. Source builds have not been run in this workspace because Docker is unavailable; CI verifies the pinned upstream image separately.

The submodule defaults to `update=none` so GitHub Pages publishes the web console without recursively copying the provider source tree into the site. The explicit `--checkout` above obtains the source for backend development and fork builds. Source revision checks and the container integration CI do not require that large checkout.

The upstream root license is MIT except the separately licensed `enterprise/` tree. Preserve the source licenses and notices in fork builds. This integration uses the standard model-execution API and does not enable enterprise features; an upstream image may contain enterprise components whose rights are governed separately. See [LICENSE](https://github.com/BerriAI/litellm/blob/v1.100.1/LICENSE).

## Run without provider keys

The fixture runs the actual LiteLLM proxy with a configured `mock_response`. Synthetic aliases and prices are explicitly marked as fixtures. It makes no external model calls.

```bash
npm ci
cp integrations/litellm/.env.example integrations/litellm/.env
# Set the same random local value for LITELLM_MASTER_KEY and LITELLM_API_KEY.
docker compose --env-file integrations/litellm/.env -f integrations/litellm/compose.yaml up --wait -d
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

To include the private service in a later platform plan, set `enable_litellm=true`, provide `litellm_config_yaml`, and supply `litellm_secret_arn`. Use `litellm_image` to choose a reviewed upstream or fork image digest. The service has a dedicated namespace, two replicas, a ClusterIP, nonroot containers, read-only filesystems and network policies. Only `app=ai-gateway` or `app=control-api` pods in the `neuralfence` namespace may reach port 4000. No public ingress is created. DNS and HTTPS egress are allowed; add your provider egress proxy restrictions and workload IAM roles where required.

Terraform copies the secret into a Kubernetes Secret, so its encrypted state must have restricted access. Provider-specific IAM, key rotation/rollout and an account-specific enabled plan still need deployment validation. The prototype BFF is not deployed by this Terraform. No cloud resources were provisioned for this integration.

## Verification

```bash
npm test
npm run litellm:source
# Against the Compose fixture, using its CI-only fixture key:
# LITELLM_MASTER_KEY=sk-neuralfence-ci-fixture-only-key docker compose -f integrations/litellm/compose.yaml up --wait -d
NF_TEST_LITELLM_URL=http://127.0.0.1:4000 NF_TEST_BROWSER=1 npm run test:litellm
```

The full stack test uses `sk-neuralfence-ci-fixture-only-key` solely as a synthetic local test credential. For a local Python installation of the pinned proxy, set `NF_TEST_LITELLM_BIN` to its `litellm` executable instead; the test starts and stops it automatically. GitHub CI uses the digest-pinned container and checks the mobile playground, guardrails, usage and replay behavior. Unit contract tests cover no-egress denials, residency, token accounting, redirects, errors, timeouts and durable interrupted receipts.
