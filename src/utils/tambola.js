class Tambola {
    constructor() {
      this.numbers = Array.from({ length: 90 }, (_, i) => i + 1);
      this.shuffle();
      this.currentIndex = 0;
    }
  
    shuffle() {
      for (let i = this.numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.numbers[i], this.numbers[j]] = [this.numbers[j], this.numbers[i]];
      }
    }
  
    getNextNumber() {
      if (this.currentIndex >= this.numbers.length) {
        return null;
      }
      const number = this.numbers[this.currentIndex];
      this.currentIndex++;
      return number;
    }
  
    reset() {
      this.shuffle();
      this.currentIndex = 0;
    }
  }
  
  module.exports = Tambola;
  