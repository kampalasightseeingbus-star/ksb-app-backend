"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const routeController_1 = require("../controllers/routeController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public
router.get('/', routeController_1.getAllRoutes);
router.get('/search', routeController_1.searchRoutes);
router.get('/:id', routeController_1.getRouteById);
router.get('/:id/schedules', routeController_1.getRouteSchedules);
// Admin only
router.post('/', auth_1.authenticate, auth_1.authorizeAdmin, routeController_1.createRoute);
router.put('/:id', auth_1.authenticate, auth_1.authorizeAdmin, routeController_1.updateRoute);
router.delete('/:id', auth_1.authenticate, auth_1.authorizeAdmin, routeController_1.deleteRoute);
exports.default = router;
