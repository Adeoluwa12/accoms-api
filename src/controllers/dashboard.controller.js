const Attendee = require('../models/Attendee');
const Unit = require('../models/Unit');
const Event = require('../models/Event');

// GET /dashboard/stats?eventId=
exports.getStats = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

    const [
      registered,
      present,
      malePresent,
      femalePresent,
      assigned,
      activeUnits,
      activeRooms,
      activeDorms,
      workersTotal,
      workersPresent,
    ] = await Promise.all([
      Attendee.countDocuments({ eventId }),
      Attendee.countDocuments({ eventId, present: true }),
      Attendee.countDocuments({ eventId, present: true, gender: 'Male' }),
      Attendee.countDocuments({ eventId, present: true, gender: 'Female' }),
      Attendee.countDocuments({ eventId, assigned: true }),
      Unit.countDocuments({ eventId, isActive: true }),
      Unit.countDocuments({ eventId, isActive: true, type: 'Room' }),
      Unit.countDocuments({ eventId, isActive: true, type: 'Dorm' }),
      Attendee.countDocuments({ eventId, isWorker: true }),
      Attendee.countDocuments({ eventId, isWorker: true, present: true }),
    ]);

    res.json({
      success: true,
      data: {
        registered,
        present,
        presentPercent: registered > 0 ? Math.round((present / registered) * 100) : 0,
        malePresent,
        femalePresent,
        assigned,
        activeUnits,
        activeRooms,
        activeDorms,
        workersTotal,
        workersPresent,
        workersPresentPercent: workersTotal > 0 ? Math.round((workersPresent / workersTotal) * 100) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /dashboard/occupancy?eventId=&type=Room|Dorm
exports.getOccupancy = async (req, res) => {
  try {
    const { eventId, type } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

    const filter = { eventId, isActive: true };
    if (type) filter.type = type;

    const units = await Unit.find(filter)
      .populate('leaderId', 'firstName surname')
      .sort({ gender: 1, type: 1, name: 1 });

    const data = units.map((u) => {
      const fillPct = u.capacity > 0 ? Math.round((u.currentOccupancy / u.capacity) * 100) : 0;
      return {
        _id: u._id,
        name: u.name,
        gender: u.gender,
        type: u.type,
        capacity: u.capacity,
        reservedSlots: u.reservedSlots,
        currentOccupancy: u.currentOccupancy,
        availableSlots: u.capacity - u.reservedSlots - u.currentOccupancy,
        fillPercent: fillPct,
        status: fillPct >= 100 ? 'full' : fillPct >= 80 ? 'almost-full' : 'available',
        leader: u.leaderId ? `${u.leaderId.firstName} ${u.leaderId.surname}` : null,
        isActive: u.isActive,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /dashboard/distribution?eventId=
// Church center + fellowship breakdown among checked-in attendees
exports.getDistribution = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

    const [byCenterRaw, byFellowshipRaw] = await Promise.all([
      Attendee.aggregate([
        { $match: { eventId: require('mongoose').Types.ObjectId.createFromHexString(eventId), present: true } },
        { $group: { _id: '$churchCenter', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Attendee.aggregate([
        { $match: { eventId: require('mongoose').Types.ObjectId.createFromHexString(eventId), present: true } },
        { $group: { _id: '$fellowship', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        byChurchCenter: byCenterRaw.map((r) => ({ name: r._id || 'Unknown', count: r.count })),
        byFellowship: byFellowshipRaw.map((r) => ({ name: r._id || 'Unknown', count: r.count })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /dashboard/active-event
exports.getActiveEvent = async (req, res) => {
  try {
    const event = await Event.findOne({ isActive: true });
    if (!event) return res.json({ success: true, data: null });

    const [registered, present] = await Promise.all([
      Attendee.countDocuments({ eventId: event._id }),
      Attendee.countDocuments({ eventId: event._id, present: true }),
    ]);

    res.json({ success: true, data: { ...event.toObject(), registered, present } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
