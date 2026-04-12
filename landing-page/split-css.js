const fs = require('fs');
const path = require('path');

const css = fs.readFileSync('src/home/home.css', 'utf8');

// Simplified rule matching using basic regex. Since home.css might use nested structures or media queries,
// it is better to identify which parts to move and which to keep.
// The safe approach: manually extract prefixes.
console.log("Size:", css.length);
