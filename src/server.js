const express = require('express');
const app = require('./app');

const dotenv = require('dotenv')
dotenv.config();

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});