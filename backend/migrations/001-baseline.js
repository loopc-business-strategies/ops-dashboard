/** No-op baseline migration — establishes the _migrations tracking collection on first apply. */
module.exports = {
  id: '001-baseline',
  async up() {
    // Intentionally empty; runner records this id after a successful apply.
  },
}
