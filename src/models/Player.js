const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  tickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  }],
  isWinner: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
