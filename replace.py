import os

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # JS files .toFixed(2) -> .toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    # but wait, some are like $ which is fine.
    
    # Let's just use string replacement carefully
    replacements = {
        '.toFixed(2)': \".toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })\",
        'parseFloat(producto.precio).toLocaleString(\\'es-CO\\', { minimumFractionDigits: 0 })': 'parseFloat(producto.precio).toLocaleString(\\'es-CO\\', { minimumFractionDigits: 0, maximumFractionDigits: 0 })',
        '<%= prod.precio %>': \"<%= parseFloat(prod.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) %>\",
        '<%= producto.precio %>': \"<%= parseFloat(producto.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) %>\",
    }

    new_content = content
    for old, new in replacements.items():
        if 'data-precio=' not in old: # Don't replace data attributes! Wait, we need to be careful with <%= prod.precio %> inside data-precio=\"<%= prod.precio %>\".
            pass
            
    # Safer manual replacements:
    # 1. toFixed(2)
    new_content = new_content.replace('.toFixed(2)', \".toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })\")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.js') or file.endswith('.ejs'):
            path = os.path.join(root, file)
            if 'node_modules' in path: continue
            replace_in_file(path)
print('Done!')
