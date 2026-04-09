Feature Mind Map mock data is split by area so you can add items quickly.

Where to edit:
- `orders.js`: order source, transformations, and gold views
- `contacts.js`: CRM source, transformations, and gold views
- `marketing.js`: paid marketing source, transformations, and gold views
- `warehouse.js`: passive warehouse source metadata
- `groups.js`: lanes shown in the mind map
- `insights.js`: cards shown on the right side of the map

Typical changes:
- add a new source: create a new `<source>.js` file and register it in `index.js`
- add a new group: append to `groups.js`
- add a new insight: append to `insights.js`

The app still consumes the same `createParrotRuntimeMock()` API.
