const Attendee = require('../models/Attendee');
const Unit = require('../models/Unit');
const { checkInAndAssign, undoCheckIn, manualAssign } = require('../services/allocation.service');

// Normalise incoming fellowship/churchCenter into a single fellowship value
function normFellowship(body) {
  return (body.fellowship || body.churchCenter || '').trim();
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(normalized);
}

function normWorkerRole(value) {
  return (value || '').trim();
}

function resolveWorkerFields(row, forceWorker = false) {
  const roleRaw = row.workerRole ?? row.worker_role ?? '';
  if (forceWorker) {
    return { isWorker: true, workerRole: normWorkerRole(roleRaw) };
  }

  const isWorkerRaw = row.isWorker ?? row.is_worker;
  return {
    isWorker: parseBoolean(isWorkerRaw, false),
    workerRole: normWorkerRole(roleRaw),
  };
}

// POST /attendees
exports.createAttendee = async (req, res) => {
  try {
    const { eventId, firstName, surname, gender, phone, email, address, badgeMode, isWorker, workerRole } = req.body;
    const attendee = await Attendee.create({
      eventId, firstName, surname, gender,
      fellowship: normFellowship(req.body),
      phone:   phone   || '',
      email:   email   || '',
      address: address || '',
      badgeMode: badgeMode || 'digital',
      isWorker: parseBoolean(isWorker, false),
      workerRole: normWorkerRole(workerRole),
    });
    res.status(201).json({ success: true, data: attendee });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /attendees/import  (JSON array — parsed from CSV on the frontend)
async function importAttendeeRows(req, res, { forceWorker = false } = {}) {
  try {
    const { eventId, attendees } = req.body;
    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ success: false, message: 'attendees array is required' });
    }

    const VALID_GENDERS = ['Male', 'Female'];
    const errors = [];
    const valid  = [];

    attendees.forEach((row, i) => {
      const rowNum = i + 1;
      if (!row.firstName) errors.push(`Row ${rowNum}: firstName is required`);
      if (!row.surname)   errors.push(`Row ${rowNum}: surname is required`);
      if (!row.gender || !VALID_GENDERS.includes(row.gender)) {
        errors.push(`Row ${rowNum}: gender must be Male or Female (got: "${row.gender}")`);
      }
      if (errors.length === 0) {
        const { isWorker, workerRole } = resolveWorkerFields(row, forceWorker);
        valid.push({
          eventId,
          firstName:  row.firstName.trim(),
          surname:    row.surname.trim(),
          gender:     row.gender,
          fellowship: normFellowship(row),          // merges fellowship + churchCenter
          phone:      (row.phone   || '').trim(),
          email:      (row.email   || '').trim().toLowerCase(),
          address:    (row.address || '').trim(),
          badgeMode:  row.badgeMode || 'digital',
          isWorker,
          workerRole,
        });
      }
    });

    if (errors.length > 0) {
      return res.status(422).json({ success: false, message: 'Validation errors', errors });
    }

    const inserted = await Attendee.insertMany(valid);
    res.status(201).json({ success: true, count: inserted.length, data: inserted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

exports.importAttendees = async (req, res) => {
  return importAttendeeRows(req, res, { forceWorker: false });
};

// POST /attendees/import-workers
exports.importWorkers = async (req, res) => {
  return importAttendeeRows(req, res, { forceWorker: true });
};

// GET /attendees/fellowships?eventId=  — distinct fellowship values
exports.getFellowships = async (req, res) => {
  try {
    const { eventId } = req.query;
    const match = eventId
      ? { eventId: require('mongoose').Types.ObjectId.createFromHexString(eventId), fellowship: { $nin: [null, ''] } }
      : { fellowship: { $nin: [null, ''] } };
    const values = await Attendee.distinct('fellowship', match);
    res.json({ success: true, data: values.filter(Boolean).sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /attendees
exports.getAttendees = async (req, res) => {
  try {
    const { eventId, search, gender, present, assigned, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (eventId)             filter.eventId  = eventId;
    if (gender)              filter.gender   = gender;
    if (present  !== undefined) filter.present  = present  === 'true';
    if (assigned !== undefined) filter.assigned = assigned === 'true';
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { firstName: re }, { surname: re },
        { fellowship: re }, { phone: re },
        { email: re },      { address: re },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [attendees, total] = await Promise.all([
      Attendee.find(filter)
        .populate('accommodationId', 'name type gender')
        .sort({ surname: 1, firstName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendee.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: attendees,
      pagination: {
        total,
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /attendees/:id
exports.updateAttendee = async (req, res) => {
  try {
    const allowed = ['firstName', 'surname', 'gender', 'phone', 'email', 'address', 'badgeMode'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (req.body.fellowship !== undefined || req.body.churchCenter !== undefined) {
      updates.fellowship = normFellowship(req.body);
    }
    if (req.body.isWorker !== undefined) {
      updates.isWorker = parseBoolean(req.body.isWorker, false);
    }
    if (req.body.workerRole !== undefined) {
      updates.workerRole = normWorkerRole(req.body.workerRole);
    }

    const attendee = await Attendee.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('accommodationId', 'name type gender');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found' });

    res.json({ success: true, data: attendee });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /attendees/:id/checkin
exports.checkIn = async (req, res) => {
  try {
    const result = await checkInAndAssign(req.params.id);
    if (!result.success) {
      return res.status(result.code === 'NOT_FOUND' ? 404 : 409).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /attendees/:id/undo
exports.undoCheckin = async (req, res) => {
  try {
    const result = await undoCheckIn(req.params.id);
    if (!result.success) {
      return res.status(result.code === 'NOT_FOUND' ? 404 : 409).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /attendees/:id/assign
exports.assignAttendee = async (req, res) => {
  try {
    const { unitId, useReserved = false } = req.body;
    if (!unitId) return res.status(400).json({ success: false, message: 'unitId is required' });

    const result = await manualAssign(req.params.id, unitId, useReserved);
    if (!result.success) {
      return res.status(result.code === 'NOT_FOUND' ? 404 : 409).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /attendees/:id
exports.deleteAttendee = async (req, res) => {
  try {
    const attendee = await Attendee.findById(req.params.id);
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found' });

    if (attendee.accommodationId) {
      await Unit.findByIdAndUpdate(attendee.accommodationId, { $inc: { currentOccupancy: -1 } });
      await Unit.updateOne({ leaderId: attendee._id }, { $set: { leaderId: null } });
    }

    await attendee.deleteOne();
    res.json({ success: true, message: 'Attendee deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
