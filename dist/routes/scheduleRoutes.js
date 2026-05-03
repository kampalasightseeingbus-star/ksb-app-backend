"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scheduleController_1 = require("../controllers/scheduleController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Admin
router.get('/', auth_1.authenticate, auth_1.authorizeAdmin, scheduleController_1.getAllSchedules);
router.post('/', auth_1.authenticate, auth_1.authorizeAdmin, scheduleController_1.createSchedule);
router.delete('/:id', auth_1.authenticate, auth_1.authorizeAdmin, scheduleController_1.deleteSchedule);
// Admin + Driver
router.put('/:id/status', auth_1.authenticate, auth_1.authorizeDriver, scheduleController_1.updateScheduleStatus);
exports.default = router;
