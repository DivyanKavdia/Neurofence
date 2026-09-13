# ADR-002: Optional LiteLLM provider execution

Status: accepted for the prototype integration, 13 September 2026.

The user requested a LiteLLM fork and integration with NeuralFence. The Native Gateway v2 baseline calls for product-owned native connectors and no required third-party proxy. This decision adds an optional LiteLLM implementation behind `ProviderConnector`; the native architecture and static mock remain available. The supplied source documents are unchanged.

NeuralFence owns application scope, policy versions, request/response inspection, route selection, budget checks, execution receipts and evidence. LiteLLM supplies provider protocol adapters and text model execution. Its management UI, virtual-key administration, budgets, MCP authorization and enterprise features are not used by this integration.

The first implemented slice is `/api/v1/runtime/model` in the existing control BFF. It sends a single approved text request to LiteLLM's `/v1/chat/completions`, buffers the completion for response checks, and returns the existing trace envelope. Model aliases, deployment regions and INR rates are operator-managed server configuration; the browser cannot choose an upstream URL, credential or arbitrary model. There is no automatic retry or hidden upstream fallback. Additional models are mapped explicitly to NeuralFence provider IDs and selected through its existing route and budget rules.

Before external execution, the prototype durably saves a request hash, trace and conservative reservation. Successful or failed outcomes replace that pending record. Reusing the same execution key cannot create another provider call, including after a process restart. An interrupted call stays pending for operator reconciliation. This is a single-process evaluation implementation; production needs database transactions, distributed reservations, authenticated principals and a reconciliation worker.

Following the user's request to merge code directly, LiteLLM backend source is now tracked as regular files in `vendor/litellm`. The import includes its Python package, Rust source and build metadata at the reviewed fork commit. It preserves the upstream license and excludes the root enterprise tree and generated upstream dashboard. Neurofence continues to own the UI and control plane.

The container uses a pinned dependency image and explicitly loads the imported Python package. Its entry point verifies source provenance and the imported module path before serving requests. The native Rust extension is not compiled or enabled by this profile. A later dependency or native upgrade requires a reviewed build and full integration tests. Cloud deployment requires the resulting Neurofence image digest.

The user-created fork `DivyanKavdia/litellm` remains the update source. The source manifest records upstream hashes, and the lock records the current digest and local patch count. The importer refuses to overwrite local patches; upstream diffs can be applied with a three-way merge. GitHub Pages excludes backend source through its Jekyll configuration.

Sources: [LiteLLM v1.100.1](https://github.com/BerriAI/litellm/releases/tag/v1.100.1), [upstream license](https://github.com/BerriAI/litellm/blob/v1.100.1/LICENSE), [configuration reference](https://docs.litellm.ai/docs/proxy/configs).
