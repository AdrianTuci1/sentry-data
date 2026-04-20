# Terraform Infrastructure

Acest scaffold gestioneaza resursele durabile folosite de runtime:

- DynamoDB single-table pentru backend;
- Cloudflare R2 bucket pentru raw sources, projections, runtime artifacts, query cache, feedback si widget catalog.

Modal apps (`sentinel`, `pne`, `analytics-worker`, `ml-executor`) raman deploy-uri aplicative separate prin `modal deploy`, deoarece URL-urile lor sunt apoi injectate in backend prin env vars.

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Dupa `apply`, foloseste output-ul `backend_env` pentru `.env` in `sentry-backend`.

## Next Infra Items

- state backend remote pentru Terraform;
- IAM / access-key rotation policy pentru R2 si DynamoDB;
- secrets manager pentru `JWT_SECRET`, `INTERNAL_API_SECRET`, R2 keys si Modal endpoint URLs;
- CI job care ruleaza `terraform plan` la PR si `apply` pe environment protejat;
- optional: Cloudflare worker/API gateway pentru endpoint-uri publice.
