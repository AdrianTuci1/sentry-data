---
title: "5. Deploy to Parrot Cloud"
sidebar_label: '5. Deploy to Parrot Cloud'
sidebar_position: 9
hide_table_of_contents: false
tags:
  - OLAP:ClickHouse
  - Tutorial
---
:::tip Parrot Cloud Trial

If this is the first time you have deployed a project onto Parrot Cloud, you will automatically start your [Parrot Cloud Trial] () upon deployment of your Parrot project. Your trial will last for 30 days. Please refer [here] () for more information on the details of your trial.

:::

## Deploy via the UI!

Select the `Deploy to share` button in the top right corner of a dashboard.

![Deploy UI](/img/tutorials/statsparrot-basics/deploy-ui.gif)

Steps to deploy to Parrot Cloud:
1. Select the `Deploy to share` button.
2. Select `continue` on the free trial [link to article of free trial explanation]
    - If you have multiple organizations, please select Parrot_Learn and `continue`.
3. Select `continue` on user invites.
4. You will be navigated to the /status page of your deployed project.


Take note of the following features in the UI:
![UI Explained](/img/tutorials/statsparrot-basics/ui-explained.gif)
## In case of the following error:

```bash
connection: dial tcp 127.0.0.1:9000: connect: connection refused
```

This is likely due to using a locally running ClickHouse server. If so, you will not be able to access your locally running server from Parrot Cloud. Instead, we suggest using [ClickHouse Cloud](https://clickhouse.com/cloud). 

For steps to set up ClickHouse Cloud, please refer to [our documentation](https://docs.statsparrot.com/developers/build/connectors/olap/clickhouse#connecting-to-clickhouse-cloud).
