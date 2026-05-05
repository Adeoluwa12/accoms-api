// const Attendee = require('../models/Attendee');
// const Unit = require('../models/Unit');
// const { checkInAndAssign, undoCheckIn, manualAssign } = require('../services/allocation.service');

// // POST /attendees
// exports.createAttendee = async (req, res) => {
//   try {
//     const { eventId, firstName, surname, gender, churchCenter, fellowship, badgeMode } = req.body;
//     const attendee = await Attendee.create({
//       eventId, firstName, surname, gender,
//       churchCenter: churchCenter || '',
//       fellowship: fellowship || '',
//       badgeMode: badgeMode || 'digital',
//     });
//     res.status(201).json({ success: true, data: attendee });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// // POST /attendees/import  (CSV bulk)
// exports.importAttendees = async (req, res) => {
//   try {
//     const { eventId, attendees } = req.body;
//     if (!Array.isArray(attendees) || attendees.length === 0) {
//       return res.status(400).json({ success: false, message: 'attendees array is required' });
//     }

//     const VALID_GENDERS = ['Male', 'Female'];
//     const errors = [];
//     const valid = [];

//     attendees.forEach((row, i) => {
//       const rowNum = i + 1;
//       if (!row.firstName) errors.push(`Row ${rowNum}: firstName is required`);
//       if (!row.surname) errors.push(`Row ${rowNum}: surname is required`);
//       if (!row.gender || !VALID_GENDERS.includes(row.gender)) {
//         errors.push(`Row ${rowNum}: gender must be Male or Female`);
//       }
//       if (errors.length === 0) {
//         valid.push({
//           eventId,
//           firstName: row.firstName.trim(),
//           surname: row.surname.trim(),
//           gender: row.gender,
//           churchCenter: (row.churchCenter || '').trim(),
//           fellowship: (row.fellowship || '').trim(),
//           badgeMode: row.badgeMode || 'digital',
//         });
//       }
//     });

//     if (errors.length > 0) {
//       return res.status(422).json({ success: false, message: 'Validation errors', errors });
//     }

//     const inserted = await Attendee.insertMany(valid);
//     res.status(201).json({ success: true, count: inserted.length, data: inserted });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // GET /attendees?eventId=&search=&gender=&present=&assigned=&page=&limit=
// exports.getAttendees = async (req, res) => {
//   try {
//     const { eventId, search, gender, present, assigned, page = 1, limit = 50 } = req.query;
//     const filter = {};

//     if (eventId) filter.eventId = eventId;
//     if (gender) filter.gender = gender;
//     if (present !== undefined) filter.present = present === 'true';
//     if (assigned !== undefined) filter.assigned = assigned === 'true';
//     if (search) {
//       const re = new RegExp(search, 'i');
//       filter.$or = [{ firstName: re }, { surname: re }, { fellowship: re }, { churchCenter: re }];
//     }

//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const [attendees, total] = await Promise.all([
//       Attendee.find(filter)
//         .populate('accommodationId', 'name type gender')
//         .sort({ surname: 1, firstName: 1 })
//         .skip(skip)
//         .limit(parseInt(limit)),
//       Attendee.countDocuments(filter),
//     ]);

//     res.json({
//       success: true,
//       data: attendees,
//       pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // POST /attendees/:id/checkin
// exports.checkIn = async (req, res) => {
//   try {
//     const result = await checkInAndAssign(req.params.id);
//     if (!result.success) {
//       const status = result.code === 'NOT_FOUND' ? 404 : 409;
//       return res.status(status).json(result);
//     }
//     res.json(result);
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // POST /attendees/:id/undo
// exports.undoCheckin = async (req, res) => {
//   try {
//     const result = await undoCheckIn(req.params.id);
//     if (!result.success) {
//       const status = result.code === 'NOT_FOUND' ? 404 : 409;
//       return res.status(status).json(result);
//     }
//     res.json(result);
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // POST /attendees/:id/assign
// exports.assignAttendee = async (req, res) => {
//   try {
//     const { unitId, useReserved = false } = req.body;
//     if (!unitId) return res.status(400).json({ success: false, message: 'unitId is required' });

//     const result = await manualAssign(req.params.id, unitId, useReserved);
//     if (!result.success) {
//       const status = result.code === 'NOT_FOUND' ? 404 : 409;
//       return res.status(status).json(result);
//     }
//     res.json(result);
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // DELETE /attendees/:id
// exports.deleteAttendee = async (req, res) => {
//   try {
//     const attendee = await Attendee.findById(req.params.id);
//     if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found' });

//     // Release unit slot
//     if (attendee.accommodationId) {
//       await Unit.findByIdAndUpdate(attendee.accommodationId, { $inc: { currentOccupancy: -1 } });
//       // Clear leader ref if needed
//       await Unit.updateOne({ leaderId: attendee._id }, { $set: { leaderId: null } });
//     }

//     await attendee.deleteOne();
//     res.json({ success: true, message: 'Attendee deleted' });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };



const Attendee = require('../models/Attendee');
const Unit = require('../models/Unit');
const { checkInAndAssign, undoCheckIn, manualAssign } = require('../services/allocation.service');

// Normalise incoming fellowship/churchCenter into a single fellowship value
function normFellowship(body) {
  return (body.fellowship || body.churchCenter || '').trim();
}

// POST /attendees
exports.createAttendee = async (req, res) => {
  try {
    const { eventId, firstName, surname, gender, phone, email, address, badgeMode } = req.body;
    const attendee = await Attendee.create({
      eventId, firstName, surname, gender,
      fellowship: normFellowship(req.body),
      phone:   phone   || '',
      email:   email   || '',
      address: address || '',
      badgeMode: badgeMode || 'digital',
    });
    res.status(201).json({ success: true, data: attendee });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /attendees/import  (CSV bulk)
exports.importAttendees = async (req, res) => {
  try {
    const { eventId, attendees } = req.body;
    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ success: false, message: 'attendees array is required' });
    }

    const VALID_GENDERS = ['Male', 'Female'];
    const errors = [];
    const valid = [];

    attendees.forEach((row, i) => {
      const rowNum = i + 1;
      if (!row.firstName) errors.push(`Row ${rowNum}: firstName is required`);
      if (!row.surname)   errors.push(`Row ${rowNum}: surname is required`);
      if (!row.gender || !VALID_GENDERS.includes(row.gender)) {
        errors.push(`Row ${rowNum}: gender must be Male or Female`);
      }
      if (errors.length === 0) {
        valid.push({
          eventId,
          firstName: row.firstName.trim(),
          surname:   row.surname.trim(),
          gender:    row.gender,
          fellowship: normFellowship(row),
          phone:   (row.phone   || '').trim(),
          email:   (row.email   || '').trim().toLowerCase(),
          address: (row.address || '').trim(),
          badgeMode: row.badgeMode || 'digital',
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
};

// GET /attendees?eventId=&search=&gender=&present=&assigned=&page=&limit=
exports.getAttendees = async (req, res) => {
  try {
    const { eventId, search, gender, present, assigned, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (eventId)  filter.eventId = eventId;
    if (gender)   filter.gender  = gender;
    if (present  !== undefined) filter.present  = present  === 'true';
    if (assigned !== undefined) filter.assigned = assigned === 'true';
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { firstName: re }, { surname: re },
        { fellowship: re }, { phone: re },
        { email: re }, { address: re },
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
        total, page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /attendees/fellowships?eventId=  — distinct fellowship values for an event
exports.getFellowships = async (req, res) => {
  try {
    const { eventId } = req.query;
    const match = eventId ? { eventId: require('mongoose').Types.ObjectId.createFromHexString(eventId), fellowship: { $ne: '' } } : { fellowship: { $ne: '' } };
    const values = await Attendee.distinct('fellowship', match);
    res.json({ success: true, data: values.filter(Boolean).sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /attendees/:id  — edit attendee details
exports.updateAttendee = async (req, res) => {
  try {
    const allowed = ['firstName', 'surname', 'gender', 'phone', 'email', 'address', 'badgeMode'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Handle unified fellowship field
    if (req.body.fellowship !== undefined || req.body.churchCenter !== undefined) {
      updates.fellowship = normFellowship(req.body);
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
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(status).json(result);
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
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(status).json(result);
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
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(status).json(result);
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


// POST /attendees/import  (CSV bulk)
exports.importAttendees = async (req, res) => {
  try {
    const { eventId, attendees } = req.body;
    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res.status(400).json({ success: false, message: 'attendees array is required' });
    }

    const VALID_GENDERS = ['Male', 'Female'];
    const errors = [];
    const valid = [];

    attendees.forEach((row, i) => {
      const rowNum = i + 1;
      if (!row.firstName) errors.push(`Row ${rowNum}: firstName is required`);
      if (!row.surname) errors.push(`Row ${rowNum}: surname is required`);
      if (!row.gender || !VALID_GENDERS.includes(row.gender)) {
        errors.push(`Row ${rowNum}: gender must be Male or Female`);
      }
      if (errors.length === 0) {
        valid.push({
          eventId,
          firstName: row.firstName.trim(),
          surname: row.surname.trim(),
          gender: row.gender,
          churchCenter: (row.churchCenter || '').trim(),
          fellowship: (row.fellowship || '').trim(),
          badgeMode: row.badgeMode || 'digital',
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
};

// GET /attendees?eventId=&search=&gender=&present=&assigned=&page=&limit=
exports.getAttendees = async (req, res) => {
  try {
    const { eventId, search, gender, present, assigned, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (eventId) filter.eventId = eventId;
    if (gender) filter.gender = gender;
    if (present !== undefined) filter.present = present === 'true';
    if (assigned !== undefined) filter.assigned = assigned === 'true';
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ firstName: re }, { surname: re }, { fellowship: re }, { churchCenter: re }];
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
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /attendees/:id/checkin
exports.checkIn = async (req, res) => {
  try {
    const result = await checkInAndAssign(req.params.id);
    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(status).json(result);
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
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(status).json(result);
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
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return res.status(status).json(result);
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

    // Release unit slot
    if (attendee.accommodationId) {
      await Unit.findByIdAndUpdate(attendee.accommodationId, { $inc: { currentOccupancy: -1 } });
      // Clear leader ref if needed
      await Unit.updateOne({ leaderId: attendee._id }, { $set: { leaderId: null } });
    }

    await attendee.deleteOne();
    res.json({ success: true, message: 'Attendee deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
