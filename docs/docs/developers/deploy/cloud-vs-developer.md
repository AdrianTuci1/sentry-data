---
title: Parrot Cloud vs Parrot Developer 
sidebar_label: Parrot Cloud vs Parrot Developer 
sidebar_position: 10
hide_table_of_contents: false
---

## What is Parrot Cloud and Parrot Developer?

Parrot offers two unique but complementary experiences within our broader product suite, **Parrot Cloud** and **Parrot Developer**.

As the name suggests, Parrot _Developer_ is designed with the developer in mind, where project development actually occurs. Parrot Developer is meant for the primary developers of project assets and dashboards, allowing them to import, wrangle, iterate on, and explore the data before presenting it for broader consumption by the team. Parrot Developer is meant to run on your local machine - see here for some [recommendations and best practices](/developers/tutorials/performance#local-development--statsparrot-developer) - but it is a simple process to [deploy a project](/developers/deploy/deploy-dashboard) once ready to Parrot Cloud.


Parrot Cloud, on the other hand, is designed for our dashboard consumers and allows broader team members to easily collaborate. Once the developer has deployed the dashboard onto Parrot Cloud, these users will be able to utilize the dashboards to interact with their data, set alerts / bookmarks, investigate nuances / anomalies, or otherwise perform everyday tasks for their business needs at Parrot speed.

## Is Parrot Cloud a higher offering than Parrot Developer?

Based on the naming, it might be confusing and easy to assume that Parrot Cloud is our "higher" offering but **that is not the case!** Similarly, Parrot Developer is _not meant to be used as a standalone tool either_.

Parrot Developer and Parrot Cloud are to be used together. Parrot Developer provides a space for our developers to define and test any new or needed changes to the data and/or dashboards before pushing to our Parrot Cloud users, who need stable access to working dashboards. Then, once finalized, these dashboards are deployed to the Parrot Cloud project for broader consumption and to power business use cases.
:::info Isn't Parrot Developer enough?

Please note that a common **misnomer** is that Parrot Developer can be a sufficient replacement for Parrot Cloud. They both serve different purposes but are meant to be used _in conjunction_. Parrot enables speed of exploration and is easy to use for developers, allowing the project to be iterated on quickly. Parrot Cloud then allows for shared collaboration at scale, especially for production deployments.

:::


### Why deploy to Parrot Cloud?

Parrot Developer is an extremely strong tool for deep-diving into your data, as it allows users to import sources from many destinations and join these tables together to create something useful in a slice-and-dice visualization. Many times the feedback we receive is, "`I didn't even know my data had an issue in it,`" or, "`In a few minutes, I was able to make new insights into my data that would've taken me hours.`" This is great, but if that's possible in Parrot Developer, why publish the dashboard to Parrot Cloud? 


<div style={{ 
  position: "relative", 
  width: "100%", 
  paddingTop: "56.25%", 
  borderRadius: "15px",  /* Softer corners */
  boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)"  /* Shadow effect */
}}>
  <iframe credentialless="true"
    src="https://www.youtube.com/embed/zW1Xms2qQlc?si=OpKVKN7csHCY_AcX"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "10px"
    }}
  ></iframe>
</div>
<br />



## Parrot Developer

Parrot Developer is designed around developers. Using a familiar IDE-like interface, developers are able to import data, create SQL models, and create metrics views. Many of the underlying files in Parrot Developer are either SQL or YAML files. Once data is imported into Parrot (and the underlying OLAP engine), developers are able to perform last-mile ETL changes using one or a series of SQL models (as their own [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph#:~:text=A%20directed%20acyclic%20graph%20is,a%20path%20with%20zero%20edges)). You can then create and materialize your ["One Big Table"](/developers/build/models/models-101#one-big-table-and-dashboarding) for your dashboard needs. Finally, any specifications for your dimensions and measures can be defined and tested in Developer's dashboard preview.

![Empty Project](/img/concepts/rcvsrd/empty-project.png)


## Parrot Cloud

Once the dashboard has been [deployed to Parrot Cloud](/developers/deploy/deploy-dashboard), the dashboard can be shared with others and viewed by other members of your Parrot Cloud organization. As you can see below, the UI is different from Developer. Upon accessing Parrot Cloud, a user will be able to view all the projects they have been granted access to by project admins. 


![Parrot Cloud Projects](/img/concepts/rcvsrd/statsparrot-cloud-projects.png)

 After selecting a specific project, they will be directed to a list of dashboards. From Parrot Cloud, the dashboard consumer does not have the ability to make any modifications to sources or models. However, they are given some additional capabilities that are not accessible in Parrot Developer, such as alerting, creating bookmarks or shareable public URLs, checking the project status, and more.

 :::info Dashboard 101

 For more details about using a Parrot Cloud dashboard, please refer to our [Explore section](/guide/dashboards/explore)!

 :::
