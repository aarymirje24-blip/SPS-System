const userModel = require('./src/models/user.model.js');

async function test() {
    try {
        const result = await userModel.findAllByOrg("6bd6b04d-e962-43bb-a309-8b2b73bc326c", { page: 1, limit: 20 });
        console.log("Success", result);
    } catch(err) {
        console.error("Error:", err);
    }
    process.exit(0);
}
test();
