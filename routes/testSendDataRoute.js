const { Router } = require("express");
const express = require("express");

router = express.Router();

testSendDataRoute = require("../controllers/testSendDataToClient");
router.get("/", testSendDataRoute.testSendDataToClient);

module.exports = router;
