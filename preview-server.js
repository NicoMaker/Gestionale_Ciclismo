const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const frontendPath = path.join(__dirname, 'frontend');

app.use(express.static(frontendPath));
app.get('*', (_req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.listen(port, () => console.log(`[v0] Gestionale frontend disponibile su http://localhost:${port}`));
