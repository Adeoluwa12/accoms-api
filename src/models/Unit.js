const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['Male', 'Female'], required: true, index: true },
    type: { type: String, enum: ['Room', 'Dorm'], required: true },
    capacity: { type: Number, required: true, min: 1 },
    reservedSlots: { type: Number, default: 0, min: 0 },
    currentOccupancy: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee', default: null },
  },
  { timestamps: true }
);

// Compound index for fast scoring queries
unitSchema.index({ eventId: 1, gender: 1, isActive: 1 });

// Virtual: available slots (excluding reserved)
unitSchema.virtual('availableSlots').get(function () {
  return this.capacity - this.reservedSlots - this.currentOccupancy;
});

// Ensure occupancy never exceeds capacity
// Ensure occupancy never exceeds capacity
unitSchema.pre('save', async function () {
  // 'this' refers to the document being saved
  if (this.currentOccupancy > this.capacity) {
    throw new Error('Occupancy cannot exceed capacity');
  }
  // No next() needed for async middleware!
});

module.exports = mongoose.model('Unit', unitSchema);
