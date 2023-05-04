const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: Number,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  },
  numbers: {
    type: [Number],
    required: true,
    validate: {
      validator: (array) => array.length === 15,
      message: 'Ticket must have 15 numbers'
    }
  },
  isClaimed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
