const mongoose = require('mongoose');
const Unit = require('../models/Unit');
const Attendee = require('../models/Attendee');

/**
 * SCORING ALGORITHM
 * For each candidate unit, compute concentration score:
 *   score = (# same churchCenter * 2) + (# same fellowship * 3)
 * Fellowship weighted higher — it's more tight-knit.
 * Lower score = better distribution = preferred assignment.
 * Tiebreak: lowest occupancy → then first in list.
 */
async function scoreUnit(unit, churchCenter, fellowship) {
  const occupants = await Attendee.find({ accommodationId: unit._id });

  let score = 0;
  for (const occ of occupants) {
    if (churchCenter && occ.churchCenter && occ.churchCenter.toLowerCase() === churchCenter.toLowerCase()) {
      score += 2;
    }
    if (fellowship && occ.fellowship && occ.fellowship.toLowerCase() === fellowship.toLowerCase()) {
      score += 3;
    }
  }
  return score;
}

/**
 * AUTO-ASSIGN
 * Rooms first → Dorms second.
 * If all full → return error asking admin to add capacity.
 * Reserved slots are invisible to auto-assignment.
 */
async function autoAssign(attendee) {
  const { gender, churchCenter, fellowship, eventId } = attendee;

  // Get all active, gender-matching units for this event
  const candidates = await Unit.find({
    eventId,
    gender,
    isActive: true,
  });

  // Filter to units with available non-reserved space
  const available = candidates.filter(
    (u) => u.currentOccupancy < u.capacity - u.reservedSlots
  );

  if (available.length === 0) {
    return {
      success: false,
      code: 'NO_CAPACITY',
      message: `No available ${gender} accommodation. Please add more rooms or dorms.`,
    };
  }

  // Rooms preferred over Dorms
  const rooms = available.filter((u) => u.type === 'Room');
  const dorms = available.filter((u) => u.type === 'Dorm');
  const pool = rooms.length > 0 ? rooms : dorms;

  // Score each unit
  const scored = await Promise.all(
    pool.map(async (unit) => {
      const score = await scoreUnit(unit, churchCenter, fellowship);
      return { unit, score };
    })
  );

  // Sort: score ASC, then occupancy ASC
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.unit.currentOccupancy - b.unit.currentOccupancy;
  });

  const bestUnit = scored[0].unit;
  return { success: true, unit: bestUnit };
}

/**
 * PERFORM ASSIGNMENT (atomic)
 * Vacates old unit if needed, assigns to new unit.
 */
async function performAssignment(attendee, targetUnit, session) {
  const opts = session ? { session } : {};

  // Vacate previous unit if any
  if (attendee.accommodationId && !attendee.accommodationId.equals(targetUnit._id)) {
    await Unit.findByIdAndUpdate(
      attendee.accommodationId,
      { $inc: { currentOccupancy: -1 } },
      opts
    );
  }

  // Increment new unit
  await Unit.findByIdAndUpdate(
    targetUnit._id,
    { $inc: { currentOccupancy: 1 } },
    opts
  );

  // Update attendee
  attendee.accommodationId = targetUnit._id;
  attendee.assigned = true;
  await attendee.save(opts);

  return attendee;
}

/**
 * CHECK-IN + AUTO-ASSIGN (main entry point)
 * Idempotent: if already checked in, returns current state.
 */
async function checkInAndAssign(attendeeId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const attendee = await Attendee.findById(attendeeId).session(session);
    if (!attendee) {
      await session.abortTransaction();
      return { success: false, code: 'NOT_FOUND', message: 'Attendee not found' };
    }

    const alreadyIn = attendee.present;

    // Mark present
    attendee.present = true;

    // If not already assigned, auto-assign
    if (!attendee.assigned) {
      const result = await autoAssign(attendee);
      if (!result.success) {
        await session.abortTransaction();
        return result;
      }
      await performAssignment(attendee, result.unit, session);
    } else {
      await attendee.save({ session });
    }

    await session.commitTransaction();

    const populated = await Attendee.findById(attendeeId).populate('accommodationId');
    return { success: true, attendee: populated, alreadyIn };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * MANUAL ASSIGN
 * Gender check enforced. useReserved bypasses reserved slot buffer.
 */
async function manualAssign(attendeeId, unitId, useReserved = false) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const attendee = await Attendee.findById(attendeeId).session(session);
    if (!attendee) {
      await session.abortTransaction();
      return { success: false, code: 'NOT_FOUND', message: 'Attendee not found' };
    }

    const unit = await Unit.findById(unitId).session(session);
    if (!unit) {
      await session.abortTransaction();
      return { success: false, code: 'NOT_FOUND', message: 'Unit not found' };
    }

    // Gender check
    if (unit.gender !== attendee.gender) {
      await session.abortTransaction();
      return {
        success: false,
        code: 'GENDER_MISMATCH',
        message: `Cannot assign ${attendee.gender} attendee to ${unit.gender} unit`,
      };
    }

    // Capacity check
    const effectiveCapacity = useReserved ? unit.capacity : unit.capacity - unit.reservedSlots;
    // If reassigning to same unit, don't count their existing slot
    const isSameUnit = attendee.accommodationId && attendee.accommodationId.equals(unit._id);
    const effectiveOccupancy = isSameUnit ? unit.currentOccupancy - 1 : unit.currentOccupancy;

    if (effectiveOccupancy >= effectiveCapacity) {
      await session.abortTransaction();
      return {
        success: false,
        code: 'FULL',
        message: useReserved ? 'Unit is completely full' : 'Unit is full (excluding reserved slots). Use reserved override to force.',
      };
    }

    await performAssignment(attendee, unit, session);
    await session.commitTransaction();

    const populated = await Attendee.findById(attendeeId).populate('accommodationId');
    return { success: true, attendee: populated };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * UNDO CHECK-IN
 * Reverses check-in: marks absent, unassigned, releases slot.
 */
async function undoCheckIn(attendeeId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const attendee = await Attendee.findById(attendeeId).session(session);
    if (!attendee) {
      await session.abortTransaction();
      return { success: false, code: 'NOT_FOUND', message: 'Attendee not found' };
    }

    if (!attendee.present) {
      await session.abortTransaction();
      return { success: false, code: 'NOT_CHECKED_IN', message: 'Attendee is not checked in' };
    }

    // Release unit slot
    if (attendee.accommodationId) {
      await Unit.findByIdAndUpdate(
        attendee.accommodationId,
        { $inc: { currentOccupancy: -1 } },
        { session }
      );

      // Clear leader if this attendee was leader
      await Unit.updateOne(
        { leaderId: attendee._id },
        { $set: { leaderId: null } },
        { session }
      );
    }

    attendee.present = false;
    attendee.assigned = false;
    attendee.accommodationId = null;
    await attendee.save({ session });

    await session.commitTransaction();
    return { success: true, attendee };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { autoAssign, checkInAndAssign, manualAssign, undoCheckIn, performAssignment };
