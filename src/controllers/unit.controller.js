const Unit = require('../models/Unit');
const Attendee = require('../models/Attendee');
const { manualAssign } = require('../services/allocation.service');

// POST /units
exports.createUnit = async (req, res) => {
  try {
    const { eventId, name, gender, type, capacity, reservedSlots } = req.body;

    if (reservedSlots !== undefined && reservedSlots >= capacity) {
      return res.status(400).json({
        success: false,
        message: 'reservedSlots must be less than capacity',
      });
    }

    const unit = await Unit.create({ eventId, name, gender, type, capacity, reservedSlots: reservedSlots || 0 });
    res.status(201).json({ success: true, data: unit });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /units?eventId=&gender=&type=&isActive=
exports.getUnits = async (req, res) => {
  try {
    const { eventId, gender, type, isActive } = req.query;
    const filter = {};

    if (eventId) filter.eventId = eventId;
    if (gender) filter.gender = gender;
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const units = await Unit.find(filter)
      .populate('leaderId', 'firstName surname gender')
      .sort({ type: 1, name: 1 });

    // Attach occupant list to each unit
    const enriched = await Promise.all(
      units.map(async (unit) => {
        const occupants = await Attendee.find(
          { accommodationId: unit._id },
          'firstName surname gender churchCenter fellowship'
        );
        const obj = unit.toObject({ virtuals: true });
        obj.occupants = occupants;
        return obj;
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /units/:id
exports.getUnit = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id).populate('leaderId', 'firstName surname gender');
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    const occupants = await Attendee.find(
      { accommodationId: unit._id },
      'firstName surname gender churchCenter fellowship present'
    );

    const obj = unit.toObject({ virtuals: true });
    obj.occupants = occupants;
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /units/:id/toggle — activate/deactivate (never delete)
exports.toggleUnit = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    unit.isActive = !unit.isActive;
    await unit.save();
    res.json({ success: true, data: unit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /units/:id — update unit details
exports.updateUnit = async (req, res) => {
  try {
    const { name, capacity, reservedSlots } = req.body;
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    if (capacity !== undefined) {
      if (capacity < unit.currentOccupancy) {
        return res.status(400).json({
          success: false,
          message: `Capacity cannot be less than current occupancy (${unit.currentOccupancy})`,
        });
      }
      unit.capacity = capacity;
    }

    if (reservedSlots !== undefined) {
      const effectiveCap = unit.capacity - unit.currentOccupancy;
      if (reservedSlots >= effectiveCap) {
        return res.status(400).json({
          success: false,
          message: 'reservedSlots would leave no available space for regular assignment',
        });
      }
      unit.reservedSlots = reservedSlots;
    }

    if (name) unit.name = name;
    await unit.save();
    res.json({ success: true, data: unit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /units/:id — permanently delete a unit
exports.deleteUnit = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Unit not found' });
    }

    // Optionally, check for occupants before deleting and prevent deletion if occupied
    const occupantCount = await Attendee.countDocuments({ accommodationId: unit._id });
    if (occupantCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a unit that still has occupants.',
      });
    }

    await Unit.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Unit deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /units/:id/leader — set or clear room leader
exports.setLeader = async (req, res) => {
  try {
    const { attendeeId } = req.body; // null to clear

    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    if (attendeeId) {
      const attendee = await Attendee.findById(attendeeId);
      if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found' });

      // Leader must be an occupant of this unit
      if (!attendee.accommodationId || !attendee.accommodationId.equals(unit._id)) {
        return res.status(400).json({
          success: false,
          message: 'Leader must be an occupant of this unit',
        });
      }

      // Clear leader from any other unit first
      await Unit.updateMany({ leaderId: attendeeId }, { $set: { leaderId: null } });
      unit.leaderId = attendeeId;
    } else {
      unit.leaderId = null;
    }

    await unit.save();
    const populated = await Unit.findById(unit._id).populate('leaderId', 'firstName surname gender');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /units/:id/reserved-assign — assign into reserved slots
exports.reservedAssign = async (req, res) => {
  try {
    const { attendeeId } = req.body;
    if (!attendeeId) return res.status(400).json({ success: false, message: 'attendeeId is required' });

    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    if (unit.reservedSlots === 0) {
      return res.status(400).json({ success: false, message: 'This unit has no reserved slots' });
    }

    const result = await manualAssign(attendeeId, req.params.id, true);
    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
