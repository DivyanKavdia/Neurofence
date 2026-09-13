# Third-party source

`vendor/litellm` contains LiteLLM backend source from [DivyanKavdia/litellm](https://github.com/DivyanKavdia/litellm), originally developed by [BerriAI/litellm](https://github.com/BerriAI/litellm). The exact revision and imported-file hashes are recorded in `integrations/litellm/source.lock.json` and `source.manifest.json`.

Copyright (c) 2023 Berri AI. The original [LICENSE](vendor/litellm/LICENSE) is preserved. The imported backend includes the Python package, Rust source and supporting build metadata. The separately licensed root `enterprise/` tree and the generated upstream dashboard are outside this source import. Neurofence provides the product console.

The container reuses a digest-pinned upstream image as its dependency layer and loads the Python backend from Neurofence's tracked source. That base image contains separately distributed dependencies and components, including enterprise packages, with their own license terms. This integration does not activate licensed enterprise features or change their terms. The optional native Rust accelerator is not compiled or enabled by the integrated Python runtime.
