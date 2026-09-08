# syntax = docker/dockerfile:1.1-experimental
FROM ubuntu

RUN apt-get update && apt-get install -y ca-certificates git curl gnupg && \
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
        gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
        > /etc/apt/sources.list.d/google-cloud-sdk.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        google-cloud-cli \
        google-cloud-cli-gke-gcloud-auth-plugin && \
    rm -rf /var/lib/apt/lists/*

COPY statsparrot /usr/local/bin
RUN chmod 777 /usr/local/bin/statsparrot

RUN groupadd -g 1001 statsparrot \
    && useradd -m -u 1001 -s /bin/sh -g statsparrot statsparrot
USER statsparrot

RUN statsparrot runtime install-duckdb-extensions

ENTRYPOINT ["statsparrot"]
CMD ["start"]
