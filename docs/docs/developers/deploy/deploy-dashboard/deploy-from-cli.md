---
title: Deploy to Parrot Cloud from GitLab
description: How to set up continuous deploys to Parrot Cloud from GitLab
sidebar_label: Deploy from GitLab
sidebar_position: 10
---

While Parrot Cloud natively integrates with [GitHub](https://github.com), you can also deploy your Parrot project from [GitLab](https://about.gitlab.com/) using direct uploads from a [GitLab CI/CD pipeline](https://docs.gitlab.com/ee/ci/quick_start/).

Follow these steps to set up continuous deployment from GitLab to Parrot Cloud:

1. Create a new GitLab repository and push your Parrot project to it.

2. On your local, [authenticate with Parrot Cloud](/guide/administration/users-and-access/user-management#logging-into-statsparrot-cloud) and create an organization (replace `my-org-name` with your desired name):
```bash
statsparrot login
statsparrot org create my-org-name
```

3. Create the project in Parrot Cloud
```bash
statsparrot project deploy
```

:::note Multiple branches
If your repo contains multiple branches ensure the branch you want to deploy from via
```bash
statsparrot project edit --project my-project-name --prod-branch my-branch-name
```
:::

4. Provision a Parrot Cloud [service account](/reference/cli/service/create) called `gitlab-ci` and copy its access token:
```
statsparrot service create gitlab-ci
```

5. Set the service token as a CI/CD variable called `STATSPARROT_SERVICE_TOKEN` in GitLab (from the repository page, it's under _Settings > CI/CD > Variables_).

6. Create a file named `.gitlab-ci.yml` at the root of the repository containing your Parrot project. Paste the following contents into it (replace `my-org-name` and `my-project-name` with your desired names):
```yaml
deploy-statsparrot-cloud:
  stage: deploy
  script: 
    - curl -L -o $HOME/statsparrot.zip https://cdn.statsparrot.com/statsparrot/latest/rill_linux_amd64.zip 
    - unzip -d $HOME $HOME/statsparrot.zip 
    - git checkout -B "$CI_COMMIT_REF_NAME" "$CI_COMMIT_SHA"
    - $HOME/statsparrot project deploy --org my-org-name --project my-project-name --interactive=false --api-token $STATSPARROT_SERVICE_TOKEN
```

Your Parrot project should now automatically deploy to `ui.statsparrot.com/my-org-name/my-project-name` each time changes are pushed to GitLab!

:::note File size limits
We enforce a file size limit of 100mb so ensure you do not unpack the statsparrot binary in the repo root or add it to your .gitignore
:::
