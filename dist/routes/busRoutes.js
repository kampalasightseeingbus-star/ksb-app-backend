"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const busController_1 = require("../controllers/busController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Admin
router.get('/', auth_1.authenticate, auth_1.authorizeAdmin, busController_1.getAllBuses);
router.post('/', auth_1.authenticate, auth_1.authorizeAdmin, busController_1.createBus);
router.put('/:id', auth_1.authenticate, auth_1.authorizeAdmin, busController_1.updateBus);
// Driver
router.post('/location', auth_1.authenticate, auth_1.authorizeDriver, busController_1.updateBusLocation);
router.get('/my-schedule', auth_1.authenticate, auth_1.authorizeDriver, busController_1.getDriverSchedule);
router.get('/manifest/:schedule_id', auth_1.authenticate, auth_1.authorizeDriver, busController_1.getPassengerManifest);
router.post('/approaching-stop', auth_1.authenticate, auth_1.authorizeDriver, busController_1.markApproachingStop);
router.post('/arrived-at-stop', auth_1.authenticate, auth_1.authorizeDriver, busController_1.markArrivedAtStop);
router.post('/trip-complete', auth_1.authenticate, auth_1.authorizeDriver, busController_1.markTripComplete);
// Passenger
router.get('/:bus_id/location', auth_1.authenticate, busController_1.getBusLocation);
exports.default = router;
