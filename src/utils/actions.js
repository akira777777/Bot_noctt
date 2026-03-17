function parseActionId(action) {
  return Number(action.split(":")[2]);
}

module.exports = {
  parseActionId,
};
