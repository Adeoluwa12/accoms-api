const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const Unit = require('../models/Unit');

// POST /events
exports.createEvent = async (req, res) => {
  try {
    const { name, venue, startDate, endDate } = req.body;
    const event = await Event.create({ name, venue, startDate, endDate });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /events
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });

    // Attach counts
    const enriched = await Promise.all(
      events.map(async (ev) => {
        const [registered, present] = await Promise.all([
          Attendee.countDocuments({ eventId: ev._id }),
          Attendee.countDocuments({ eventId: ev._id, present: true }),
        ]);
        return { ...ev.toObject(), registered, present };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /events/:id/activate
exports.activateEvent = async (req, res) => {
  try {
    // Deactivate all
    await Event.updateMany({}, { isActive: false });
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /events/:id
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Cascade delete
    await Attendee.deleteMany({ eventId: event._id });
    await Unit.deleteMany({ eventId: event._id });
    await event.deleteOne();

    // If this was active, activate first remaining event
    if (event.isActive) {
      const next = await Event.findOne().sort({ createdAt: -1 });
      if (next) await Event.findByIdAndUpdate(next._id, { isActive: true });
    }

    res.json({ success: true, message: 'Event and all related data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
