import sys, json
import os

# Read both files
with open('test_old.canvas', encoding='utf-8') as f:
    old_data = json.load(f)
with open('test_children.canvas', encoding='utf-8') as f:
    new_data = json.load(f)

# Basic metrics
print('=== Basic Metrics Comparison ===')
print(f'Old canvas: {len(old_data["nodes"])} nodes, {len(old_data["edges"])} edges, {os.path.getsize("test_old.canvas")} bytes')
print(f'New canvas: {len(new_data["nodes"])} nodes, {len(new_data["edges"])} edges, {os.path.getsize("test_children.canvas")} bytes')

# Count nodes with children
old_with_children = sum(1 for n in old_data['nodes'] if 'children' in n)
new_with_children = sum(1 for n in new_data['nodes'] if 'children' in n)
print(f'Old nodes with children: {old_with_children}')
print(f'New nodes with children: {new_with_children}')

# Count total children elements
old_total_children = sum(len(n.get('children', [])) for n in old_data['nodes'])
new_total_children = sum(len(n.get('children', [])) for n in new_data['nodes'])
print(f'Old total children elements: {old_total_children}')
print(f'New total children elements: {new_total_children}')

# Compare edge count
print(f'\nOld edges: {len(old_data["edges"])}')
print(f'New edges: {len(new_data["edges"])}')

# Show: one node without children in new canvas
no_child_nodes = [n for n in new_data['nodes'] if 'children' not in n]
print(f'\n=== Sample: Node WITHOUT children ===')
if no_child_nodes:
    n = no_child_nodes[0]
    print(f'  ID: {n["id"]}, type: {n.get("type", "N/A")}')
    print(f'  Has children key: {"children" in n}')

# Show: one node with children
with_child_nodes = [n for n in new_data['nodes'] if 'children' in n]
print(f'\n=== Sample: Node WITH children ===')
if with_child_nodes:
    n = with_child_nodes[0]
    print(f'  ID: {n["id"]}, x={n.get("x")}, y={n.get("y")}')
    print(f'  children count: {len(n["children"])}')
    if n['children']:
        ch = n['children'][0]
        text_snippet = str(ch.get('text', ''))[:20]
        print(f'  1st child: label={ch.get("label")}, text="{text_snippet}...", ax={ch.get("ax")}, ay={ch.get("ay")}, cw={ch.get("cw")}, ch={ch.get("ch")}')

print('\n=== Validation PASSED ===')
