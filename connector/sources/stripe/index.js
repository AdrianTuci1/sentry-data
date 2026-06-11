/**
 * Stripe Connector — pulls Stripe data into BigQuery landing zone.
 *
 * Deploy: gcloud functions deploy sentry-connector-stripe --runtime nodejs22 --trigger-http --entry-point ingest
 * Schedule: Cloud Scheduler every hour
 */

const { BigQuery } = require('@google-cloud/bigquery');

const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
const BIGQUERY_DATASET = process.env.BIGQUERY_DATASET || 'sentry_dataset';
const CONNECTOR_TOKEN = process.env.CONNECTOR_TOKEN || 'dev-token';

async function fetchStripe(endpoint, params) {
  params = params || {};
  const url = new URL('https://api.stripe.com/v1/' + endpoint);
  Object.entries(params).forEach(function(e) { url.searchParams.set(e[0], e[1]); });
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + STRIPE_API_KEY } });
  return res.json();
}

async function loadToBigQuery(table, rows) {
  if (!rows || rows.length === 0) return 0;
  const bigquery = new BigQuery();
  const tableId = BIGQUERY_DATASET + '_landing.' + table;
  const enriched = rows.map(function(r) {
    r._ingested_at = new Date().toISOString();
    return r;
  });
  await bigquery.dataset(BIGQUERY_DATASET + '_landing').table(table).insert(enriched, {
    raw: true, ignoreUnknownValues: true,
  });
  return enriched.length;
}

exports.ingest = async function(req, res) {
  var token = req.headers['x-internal-token'] || req.query.token;
  if (token !== CONNECTOR_TOKEN) return res.status(401).send('Unauthorized');

  try {
    var total = 0;

    // Charges (last 24h)
    var charges = await fetchStripe('charges', { limit: 100, created: Math.floor(Date.now()/1000) - 86400 });
    if (charges.data) {
      var rows = charges.data.map(function(c) {
        return {
          id: c.id, amount: c.amount/100, currency: c.currency,
          status: c.status, customer_id: c.customer,
          description: c.description,
          timestamp: new Date(c.created * 1000).toISOString(),
        };
      });
      total += await loadToBigQuery('stripe_charges', rows);
    }

    // Customers
    var customers = await fetchStripe('customers', { limit: 100 });
    if (customers.data) {
      var rows = customers.data.map(function(c) {
        return { id: c.id, email: c.email, name: c.name, created: new Date(c.created * 1000).toISOString() };
      });
      total += await loadToBigQuery('stripe_customers', rows);
    }

    res.json({ status: 'ok', rows_ingested: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
