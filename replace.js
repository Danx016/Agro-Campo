const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.ejs')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(__dirname);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace .toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) -> .toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    content = content.replace(/\.toFixed\(2\)/g, ".toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })");
    
    // Also format EJS templates
    // But be careful NOT to replace data-precio="<%= prod.precio %>" or <%= producto.precio %> where it's used as data!
    // We only replace >$<%= parseFloat(prod.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) %>< or >$<%= parseFloat(producto.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) %><
    content = content.replace(/>\$\<%= prod\.precio %\></g, ">$<%= parseFloat(prod.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) %><");
    content = content.replace(/>\$\<%= producto\.precio %\></g, ">$<%= parseFloat(producto.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) %><");
    content = content.replace(/\$\<%= prod\.precio %\>/g, "$<%= parseFloat(prod.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) %>");
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
    }
});
console.log('Done!');
