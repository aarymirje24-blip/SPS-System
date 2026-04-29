require('./config/env');   // validates env at startup
const app = require('./app');
const env = require('./config/env');

app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
});