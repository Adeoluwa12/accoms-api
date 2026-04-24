const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    surname: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['Male', 'Female'], required: true, index: true },
    churchCenter: { type: String, trim: true, default: '' },
    fellowship: { type: String, trim: true, default: '' },

    present: { type: Boolean, default: false },
    assigned: { type: Boolean, default: false },
    accommodationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },

    badgeMode: { type: String, enum: ['digital', 'preprinted', 'manual'], default: 'digital' },
    badgePrinted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Full name virtual
attendeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.surname}`;
});

module.exports = mongoose.model('Attendee', attendeeSchema);
