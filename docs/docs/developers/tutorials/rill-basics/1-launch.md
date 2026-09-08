---
title: "1. Source to Dashboard on Parrot Cloud in 6 Steps"
sidebar_label: "1. Launch Parrot Developer"
position: 1
collapsed: false
sidebar_position: 1
tags:
  - Tutorial
  - OLAP:DuckDB
  - Parrot Developer
  - Getting Started
---
:::note prerequisites
You need to [install Parrot](https://docs.statsparrot.com/developers/get-started/install). 

```bash
curl https://statsparrot.sh | sh
```

:::

The goal of this six-part tutorial is to get started with Parrot and deploy your project to Parrot Cloud. Upon deployment, your [30-day trial will start](/developers/other/plans#trial-plan). Each course will build upon the previous one, allowing you to have a fully functioning project with many of our advanced features. This tutorial can be used in tandem with our documentation to ensure you have up-to-date information.


## Start Parrot Developer

```yaml
statsparrot start my-statsparrot-tutorial
```

:::tip
While we support macOS and Linux, you can also get Parrot Developer running on a [Windows machine via WSL](https://docs.statsparrot.com/developers/get-started/install#statsparrot-on-windows-using-wsl). If you are having any issues installing or starting Parrot, please see our [installation page](https://docs.statsparrot.com/developers/get-started/install). 

:::



If running Parrot in a new directory, you'll be prompted with the following. Type "Y" and press Enter. 

```bash
? Parrot will create project files in "~/Desktop/GitHub". Do you want to continue? (Y/n) 

```

Parrot Developer will automatically open in your default browser. If not, you can access it via the following URL:

```
localhost:9009
``` 

Welcome to Parrot Developer!

:::note What is Parrot Developer? 
Parrot Developer is used to develop your Parrot project, as editing in Parrot Cloud is not yet available. In Parrot Developer, you will create connections to your source files, perform last-mile ETL, define metrics in the metrics layer, and finally create a dashboard. For more details on the differences between Parrot Developer and Parrot Cloud, see our documentation [here](/developers/deploy/cloud-vs-developer)
:::

![New Parrot Project](/img/tutorials/statsparrot-basics/new-statsparrot-project.png)

Let's go ahead and select `Start with an empty project`. If you want to skip the basics, you can select one of the quick start projects and refer to our Quick Start Guide for the corresponding project. Note that we have many more projects available in our public repo [here](https://github.com/staticlabs/statsparrot-examples).

<details>
  <summary>Where am I in the terminal?</summary>
  
    You can use the `pwd` command to see which directory you are in within the terminal. <br />
    If this is not where you'd like to make the directory, use the `cd` command to change directories.

</details>


