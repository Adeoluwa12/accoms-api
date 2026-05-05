// const express = require('express');
// const router = express.Router();

// const eventCtrl = require('../controllers/event.controller');
// const attendeeCtrl = require('../controllers/attendee.controller');
// const unitCtrl = require('../controllers/unit.controller');
// const dashCtrl = require('../controllers/dashboard.controller');
// const reportCtrl = require('../controllers/report.controller');

// // ── EVENTS ──────────────────────────────────────────────────────────────────
// router.post('/events', eventCtrl.createEvent);
// router.get('/events', eventCtrl.getEvents);
// router.patch('/events/:id/activate', eventCtrl.activateEvent);
// router.delete('/events/:id', eventCtrl.deleteEvent);

// // ── ATTENDEES ────────────────────────────────────────────────────────────────
// router.post('/attendees', attendeeCtrl.createAttendee);
// router.post('/attendees/import', attendeeCtrl.importAttendees);
// router.get('/attendees', attendeeCtrl.getAttendees);
// router.post('/attendees/:id/checkin', attendeeCtrl.checkIn);
// router.post('/attendees/:id/undo', attendeeCtrl.undoCheckin);
// router.post('/attendees/:id/assign', attendeeCtrl.assignAttendee);
// router.delete('/attendees/:id', attendeeCtrl.deleteAttendee);

// // ── ACCOMMODATION UNITS ───────────────────────────────────────────────────────
// router.post('/units', unitCtrl.createUnit);
// router.get('/units', unitCtrl.getUnits);
// router.get('/units/:id', unitCtrl.getUnit);
// router.patch('/units/:id', unitCtrl.updateUnit);
// router.patch('/units/:id/toggle', unitCtrl.toggleUnit);
// router.post('/units/:id/leader', unitCtrl.setLeader);
// router.post('/units/:id/reserved-assign', unitCtrl.reservedAssign);

// // ── DASHBOARD (separate endpoints per section) ───────────────────────────────
// router.get('/dashboard/active-event', dashCtrl.getActiveEvent);
// router.get('/dashboard/stats', dashCtrl.getStats);
// router.get('/dashboard/occupancy', dashCtrl.getOccupancy);
// router.get('/dashboard/distribution', dashCtrl.getDistribution);

// // ── REPORTS ───────────────────────────────────────────────────────────────────
// router.get('/reports/attendance', reportCtrl.getAttendanceSheet);
// router.get('/reports/room-manifest', reportCtrl.getRoomManifest);
// router.get('/reports/unassigned', reportCtrl.getUnassigned);

// module.exports = router;


const express = require('express');
const router = express.Router();

const eventCtrl = require('../controllers/event.controller');
const attendeeCtrl = require('../controllers/attendee.controller');
const unitCtrl = require('../controllers/unit.controller');
const dashCtrl = require('../controllers/dashboard.controller');
const reportCtrl = require('../controllers/report.controller');

// ── EVENTS ──────────────────────────────────────────────────────────────────
router.post('/events', eventCtrl.createEvent);
router.get('/events', eventCtrl.getEvents);
router.patch('/events/:id/activate', eventCtrl.activateEvent);
router.delete('/events/:id', eventCtrl.deleteEvent);

// ── ATTENDEES ────────────────────────────────────────────────────────────────
router.post('/attendees', attendeeCtrl.createAttendee);
router.post('/attendees/import', attendeeCtrl.importAttendees);
router.get('/attendees/fellowships', attendeeCtrl.getFellowships);
router.get('/attendees', attendeeCtrl.getAttendees);
router.patch('/attendees/:id', attendeeCtrl.updateAttendee);
router.post('/attendees/:id/checkin', attendeeCtrl.checkIn);
router.post('/attendees/:id/undo', attendeeCtrl.undoCheckin);
router.post('/attendees/:id/assign', attendeeCtrl.assignAttendee);
router.delete('/attendees/:id', attendeeCtrl.deleteAttendee);

// ── ACCOMMODATION UNITS ───────────────────────────────────────────────────────
router.post('/units', unitCtrl.createUnit);
router.get('/units', unitCtrl.getUnits);
router.get('/units/:id', unitCtrl.getUnit);
router.patch('/units/:id', unitCtrl.updateUnit);
router.patch('/units/:id/toggle', unitCtrl.toggleUnit);
router.post('/units/:id/leader', unitCtrl.setLeader);
router.post('/units/:id/reserved-assign', unitCtrl.reservedAssign);

// ── DASHBOARD (separate endpoints per section) ───────────────────────────────
router.get('/dashboard/active-event', dashCtrl.getActiveEvent);
router.get('/dashboard/stats', dashCtrl.getStats);
router.get('/dashboard/occupancy', dashCtrl.getOccupancy);
router.get('/dashboard/distribution', dashCtrl.getDistribution);

// ── REPORTS ───────────────────────────────────────────────────────────────────
router.get('/reports/attendance', reportCtrl.getAttendanceSheet);
router.get('/reports/room-manifest', reportCtrl.getRoomManifest);
router.get('/reports/unassigned', reportCtrl.getUnassigned);

module.exports = router;
