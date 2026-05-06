const Attendee = require('../models/Attendee');
const Unit     = require('../models/Unit');

// GET /reports/attendance?eventId=&gender=&present=
exports.getAttendanceSheet = async (req, res) => {
  try {
    const { eventId, gender, present } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

    const filter = { eventId };
    if (gender)           filter.gender  = gender;
    if (present !== undefined) filter.present = present === 'true';

    const attendees = await Attendee.find(filter)
      .populate('accommodationId', 'name type')
      .sort({ surname: 1, firstName: 1 });

    const data = attendees.map((a, i) => ({
      no:         i + 1,
      surname:    a.surname,
      firstName:  a.firstName,
      gender:     a.gender,
      fellowship: a.fellowship || '',   // unified field — no more churchCenter
      phone:      a.phone      || '',
      email:      a.email      || '',
      address:    a.address    || '',
      present:    a.present,
      assigned:   a.assigned,
      unit: a.accommodationId ? `${a.accommodationId.name} (${a.accommodationId.type})` : null,
    }));

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /reports/room-manifest?eventId=
exports.getRoomManifest = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

    const units = await Unit.find({ eventId, isActive: true })
      .populate('leaderId', 'firstName surname')
      .sort({ gender: 1, type: 1, name: 1 });

    const manifest = await Promise.all(
      units.map(async (unit) => {
        const occupants = await Attendee.find(
          { accommodationId: unit._id },
          'firstName surname gender fellowship phone email address present'
        ).sort({ surname: 1 });

        return {
          unit: {
            _id:              unit._id,
            name:             unit.name,
            gender:           unit.gender,
            type:             unit.type,
            capacity:         unit.capacity,
            currentOccupancy: unit.currentOccupancy,
            leader: unit.leaderId
              ? `${unit.leaderId.firstName} ${unit.leaderId.surname}`
              : null,
          },
          occupants,
        };
      })
    );

    res.json({ success: true, data: manifest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /reports/unassigned?eventId=
exports.getUnassigned = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

    const attendees = await Attendee.find({ eventId, present: true, assigned: false })
      .sort({ surname: 1 });

    res.json({ success: true, count: attendees.length, data: attendees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
