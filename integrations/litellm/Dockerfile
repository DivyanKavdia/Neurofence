ARG LITELLM_DEPENDENCIES=ghcr.io/berriai/litellm:v1.100.1@sha256:a3715fa7ad8387941ab697259bd2881d68931657247a41984f90fae6d11c62bf
FROM ${LITELLM_DEPENDENCIES}
USER root
WORKDIR /opt/neurofence
COPY vendor/litellm ./vendor/litellm
COPY scripts/litellm_source.py ./scripts/litellm_source.py
COPY integrations/litellm/run.py integrations/litellm/import.json integrations/litellm/source.lock.json integrations/litellm/source.manifest.json ./integrations/litellm/
ENV PYTHONDONTWRITEBYTECODE=1 \
    LITELLM_LOCAL_MODEL_COST_MAP=True \
    XDG_CACHE_HOME=/tmp/cache \
    TIKTOKEN_CACHE_DIR=/tmp/tiktoken
RUN python integrations/litellm/run.py --check-source
USER 1000:1000
EXPOSE 4000
ENTRYPOINT ["python", "/opt/neurofence/integrations/litellm/run.py"]
CMD ["--host", "0.0.0.0", "--port", "4000"]
