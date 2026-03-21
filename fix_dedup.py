import re

file_path = '/Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend/src/application/pipeline/PipelineRunner.ts'
with open(file_path, 'r') as f:
    text = f.read()

# Replace the conditional inside mergeDiscovery
# from:
#                                 if (key === 'connector') {
#                                     items.forEach((newItem: any) => {
# ...
#                                 } else {
#                                     cumulativeDiscovery[key].push(...items);
#                                 }
# to deduplicate EVERYTHING by `id` if `id` exists, else just push.

new_logic = """
                                items.forEach((newItem: any) => {
                                    if (newItem.id != null) {
                                        const existingIndex = cumulativeDiscovery[key].findIndex((c: any) => c.id === newItem.id);
                                        if (existingIndex >= 0) {
                                            cumulativeDiscovery[key][existingIndex] = { ...cumulativeDiscovery[key][existingIndex], ...newItem };
                                        } else {
                                            cumulativeDiscovery[key].push(newItem);
                                        }
                                    } else {
                                        cumulativeDiscovery[key].push(newItem);
                                    }
                                });
"""

old_logic_pattern = re.compile(r"if \(key === 'connector'\) \{[\s\S]*?\} else \{\s*cumulativeDiscovery\[key\]\.push\(\.\.\.items\);\s*\}")
if old_logic_pattern.search(text):
    text = old_logic_pattern.sub(new_logic.strip(), text)
    with open(file_path, 'w') as f:
        f.write(text)
    print("Successfully updated PipelineRunner.ts merge logic.")
else:
    print("Could not find the pattern to replace in PipelineRunner.ts")
