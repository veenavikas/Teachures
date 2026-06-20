// Hostinger/cPanel Entry Point Wrapper
// Some hosting control panels require the entry file to be in the root directory.
const app = require('./src/app.js');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
