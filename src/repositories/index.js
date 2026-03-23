const { createUsersRepo } = require("./users");
const { createConversationsRepo } = require("./conversations");
const { createMessagesRepo } = require("./messages");
const { createLeadsRepo } = require("./leads");
const { createProductsRepo } = require("./products");
const { createAdminStateRepo } = require("./admin-state");
const { createSessionsRepo } = require("./sessions");
const { createStatsRepo } = require("./stats");
const { createLeadEventsRepo } = require("./lead-events");

function createRepositories(db) {
  return {
    users: createUsersRepo(db),
    conversations: createConversationsRepo(db),
    messages: createMessagesRepo(db),
    leads: createLeadsRepo(db),
    products: createProductsRepo(db),
    adminState: createAdminStateRepo(db),
    sessions: createSessionsRepo(db),
    leadEvents: createLeadEventsRepo(db),
    stats: createStatsRepo(db),
  };
}

module.exports = { createRepositories };
