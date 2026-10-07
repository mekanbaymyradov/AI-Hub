const fs = require('fs');
fetch('https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/brain-circuit.svg')
  .then(res => res.text())
  .then(text => fs.writeFileSync('public/favicon.svg', text));
